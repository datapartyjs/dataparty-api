const Joi = require('@hapi/joi')
const Hoek = require('@hapi/hoek')
const debug = require('debug')('dataparty.endpoint.key-announce')

const {Identity, Message, Routines} = require('@dataparty/crypto')

//const IEndpoint = require('@dataparty/api/src/service/iendpoint')
const IEndpoint = require('../../service/iendpoint')

const KeyVerifier = Joi.object().keys({
  id: Joi.string().max(100),
  type: Joi.string().max(300).required(),
  hash: Joi.string().max(200).required(),
  public: {
    box: Joi.string().max(60).required(),
    sign: Joi.string().max(60).required(),
    pqkem: Joi.string().max(8000).required(),
    pqsign_ml: Joi.string().max(8000).required(),
    pqsign_slh: Joi.string().max(800).required()
  }
})

module.exports = class KeyAnnounceEndpoint extends IEndpoint {

  static get Name(){
    return 'key/announce'
  }

  static get Description(){
    return 'announce a public key'
  }

  static get MiddlewareConfig(){
    return {
      pre: {
        decrypt: true,
        validate: Joi.object().keys({

          annoucement: {
            created: Joi.number().required(),
            expiry: Joi.number().required(),
            actorKey: KeyVerifier.required(),
            sessionKey: KeyVerifier.required(),
          },
          trust:{
            actorSig: Joi.string().required().description('actor signature of the annoucement in base64'),
            sessionSig: Joi.string().required().description('session signature of the annoucement in base64')
          }

        }).description('key to announce')
      },
      post: {
        encrypt: true,
        validate: Joi.object().keys({
          done: Joi.boolean(),
        }).description('public key')
      }
    }
  }

  static async run(ctx, {Package}){

    ctx.debug('hello key/announce')

    ctx.debug('ip', ctx.req.ip)
    ctx.debug('input', ctx.input)
    ctx.debug('sender', ctx.senderKey)
    
    const inputActorKey = {
      type: ctx.input.annoucement.actorKey.type,
      hash: ctx.input.annoucement.actorKey.hash,
      public: ctx.input.annoucement.actorKey.public
    }

    const inputSessionKey = {
      type: ctx.input.annoucement.sessionKey.type,
      hash: ctx.input.annoucement.sessionKey.hash,
      public: ctx.input.annoucement.sessionKey.public
    }


    const computedActorHash = await Routines.hashKey( inputActorKey )
    const computedSessionHash = await Routines.hashKey( inputSessionKey )

    ctx.debug('computed hash -', computedSessionHash)

    // verify keys are self consistent
    if(
      computedActorHash != inputActorKey.hash ||
      computedSessionHash != inputSessionKey.hash
    ) {
      ctx.debug('invalid actor or session key hash')
      return {done: false}
    }

    // ensure sender is connected using session key mentioned in annoucement
    if(computedSessionHash == inputSessionKey.hash &&
       inputSessionKey.public.sign == ctx.senderKey.public.sign &&
       inputSessionKey.public.box == ctx.senderKey.public.box
    ){

      const actorSigBson =  Routines.Utils.base64.decode( ctx.input.trust.actorSig )
      const sessionSigBson = Routines.Utils.base64.decode( ctx.input.trust.sessionSig )

      const actorSigMsg = new Message({ msg: ctx.input.annoucement })
      const sessionSigMsg = new Message({ msg: ctx.input.annoucement })

      actorSigMsg.sig =  actorSigBson
      sessionSigMsg.sig =  sessionSigBson
      
      const actorIdentity = Identity.fromJSON({
        id: '',
        key: inputActorKey
      })
      
      const sessionIdentity = Identity.fromJSON({
        id: '',
        key: inputSessionKey
      })
      
      //verify actor & session signature. Require postquantum signing
      await actorSigMsg.assertVerified( actorIdentity, true )
      await sessionSigMsg.assertVerified( sessionIdentity, true )

      let sessionKeyDoc = (await ctx.party.find()
        .type('session_key')
        .where('annoucement.sessionKey.hash').equals(computedSessionHash)
        .exec())[0]
      
      if(!sessionKeyDoc){
        // create session document

        const now = Date.now()
        const tomorrow = now + 24*60*60*1000

        const fiveMinAgo = now - (5*1000*60)
        const fiveMinFromNow = now + (5*1000*60)

        // verify start time is valid
        if(
          ctx.input.annoucement.created < fiveMinAgo ||
          ctx.input.annoucement.created > fiveMinFromNow
        ) {
          ctx.debug('invalid start time')
          return {done: false}
        }

        // verify expiry time is valid
        if(
          ctx.input.annoucement.expiry < now ||
          ctx.input.annoucement.expiry > tomorrow
        ) {
          ctx.debug('invalid expiry time')
          return {done: false}
        }

        ctx.debug('opening session -', computedSessionHash)

        let sessionDoc = await ctx.party.createDocument('session_key', {
          created: now,
          expiry: ctx.input.annoucement.expiry,
          annoucement: ctx.input.annoucement,
          trust: ctx.input.trust
        })

        ctx.debug('session created - ', computedSessionHash)

      } else {
        ctx.debug('session key already known - ', computedSessionHash)
        return {done: false}
      }

      let publicKey = (await ctx.party.find()
        .type('public_key')
        .where('annoucement.actorKey.hash').equals(computedActorHash)
        .exec())[0]

      if(!publicKey){

        ctx.debug('annoucing key -', computedActorHash)

        let keyDoc = await ctx.party.createDocument('public_key', {
          created: Date.now(),
          role: 'guest',
          owner: computedActorHash,
          ...inputActorKey
        })

        ctx.debug('actor annouced key -', computedActorHash)
      } else {
        ctx.debug('key already known -', computedActorHash)
      }

      return {done: true}

    } else {

      ctx.debug('announce ERROR - BAD KEY HASH')

      return {done: false}
    }
    
  }
}
