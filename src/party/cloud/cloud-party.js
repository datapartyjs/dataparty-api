const dataparty_crypto = require('@dataparty/crypto')
const debug = require('debug')('dataparty.cloud.party')

const Qb = require('./qb.js')
const Query = require('./query.js')
const IParty = require('../iparty')
const RestComms = require('../../comms/rest-comms')

/**
 * @class
 * @implements module:dataparty.CloudParty
 */
class CloudParty extends IParty {

  constructor({config, ...options}){
    super({ 
      config,
      ...options
    })

    this.qb = new Qb({
      call: this.call.bind(this),
      cache: this.cache
    })

    this._actor = {id: undefined, type: undefined}
    this._actors = []
    this._identity = undefined
    
    //if(uri[uri.length-1] != '/'){ uri = uri+'/' }

    this.rest = new RestComms({config: this.config, party: this})
  }

  /**
   * @method
   */
  hasIdentity(){
    return this._identity != undefined
  }

  /**
   * @method
   */
  hasActor(){
    return this.actor != undefined
  }

  /**
   * @type {module:dataparty/Types.Identity}
   */
  get identity(){
    if (!this.hasIdentity()){ return undefined }
    return this._identity.toJSON(false)
  }

  /** @type {IdObj} */
  get actor(){
    if (this.actors && this.actors[0]){

      return this.actors[0]

    } else if (this._actor.id && this._actor.type){

      return this._actor

    }

    return undefined
  }

  /** @type {IdObj[]} */
  get actors(){
    return this._actors
  }

  set actors(value){
    this._actors = value

    const primaryActor = this.actor

    if (!primaryActor){
     return
    }

    this._actor.id = primaryActor.id
    this._actor.type = primaryActor.type

    const path = 'actor'
    this.config.write(path, this._actor)
  }

  /**
   * @method
   */
  async encrypt(data, to){
    const msg = new dataparty_crypto.Message({msg: data})
    await msg.encrypt(this._identity, to.key)

    return msg
  }

  /**
   * @method
   */
  async decrypt(reply, expectedSender, expectClearTextReply = false){
    // if reply has ciphertext & sig attempt to decrypt
    if (reply.enc && reply.sig) {
      const msg = new dataparty_crypto.Message(reply)

      const replyContent = await msg.decrypt(this._identity)

      const publicKeys = dataparty_crypto.Routines.extractPublicKeys(msg.enc)

      debug(`publicKeys.sign - ${publicKeys.sign}`)

      if (publicKeys.sign !== expectedSender.key.public.sign ||
          publicKeys.box !== expectedSender.key.public.box) {
        throw new Error('TrustFail: reply is not from service')
      }

      debug('decrypted reply ->', JSON.stringify(replyContent))

      if (replyContent.error) {
        debug('call failed ->', replyContent.error)
        throw replyContent.error
      }

      return replyContent

    } else if (expectClearTextReply && !reply.error) {

      return reply

    }

    if (reply.error) {
      debug('call failed ->', reply.error)
      throw reply.error
    }

    throw new Error('TrustFail: reply is not encrypted')
  }

  /**
   * @method
   */
  async call(msg){
    return this.rest.call('api-v2-bouncer', msg)
  }

  /**
   * @method
   */
  async socket(){
    return this.rest.websocket()
  }

  /**
   * @method
   */
  async start(){
    debug('start')
    await super.start()
    await Promise.all([
      this.loadIdentity(),
      this.loadActor(),
    ])

    await this.rest.start()
  }

  async stop(){
    await this.rest.stop()
  }

  /**
   * @method
   */
  async loadIdentity(){
    const path = 'identity'
    const cfgIdenStr = this.config.read(path)

    if (!cfgIdenStr){
      debug('generated new identity')
      this._identity = new dataparty_crypto.Identity({id: 'primary'})
      await this.config.write(path, this._identity.toJSON(true))
    } else {
      debug('loaded identity')
      this._identity = dataparty_crypto.Identity.fromString(JSON.stringify(cfgIdenStr))
    }
  }

  async resetIdentity(){
    const path = 'identity'
    await this.config.write(path, null)
    await this.loadIdentity()
  }

  /**
   * @method
   */
  async loadActor(){
    const path = 'actor'
    const localActorObj = this.config.read(path)

    if (!localActorObj){ return }

    this._actor.id = localActorObj.id
    this._actor.type = localActorObj.type

    debug('loaded actor', this._actor)
  }


  /*
  * dataParty.find()
  *   .type('user')
  *   .id('xxx') // .ids([..])
  *   .select('profile.photo')
  *   .exec(true)
  *   .then((msg) => { // promise resolves to msg with _id & profile.photo ->
  *     ..             // { _id: '..', profile: { photo: '..' } }
  *   }
  *
  * dataParty.find()
  *   .type('process')
  *   .where('location').equals('mod')
  *   .select('units')
  *   .watch()
  *   -> observer that streams list of units in process & again on changes
  *
  * dataParty.find() // query with no type searches *all* tables
  *   .where('location').equals('mod')
  *   .where('status').equals('ERROR')
  *   .watch()
  *   -> observer that streams list of all msgs with ERROR status at mod
  */
  /**
   * @method
   */
  find () {
    return new Query(this.qb, this.model)
  }

  // takes modified json msgs & writes to backend, resolves to new stamps
  // requires type & id
  /**
   * @method
   */
  update (...msgs) {
    return this.qb.modify(msgs, 'update')
  }

  /*
  * inserts one or more msgs of given type into backend
  *
  * dataParty.create('device', { name: 'moonbot', .. })
  *   .then((msg) => {
  *     ..
  *   })
  *
  * create returns a deep copy of given objects as new generic javascript
  * objects with three metadata properties '_type' '_id'
  *
  * msg -> {
  *   _type: 'device', // name of backend message collection passed as arg
  *   _id: '..', // id string generated by backend db
  *   name: 'moonshot', // properties passed to create
  *   ..
  * }
  */
  /**
   * @method
   */
  create (type, ...msgs) {
    return this.qb.create(type, msgs)
  }

  /*
  * removes msgs listed (requires type & id)
  * * resolves to headers of removed msgs
  *
  * dataParty.find('device').id('xxx').get()
  *   .then((msg) => {
  *      dataParty.remove('device',
  *        msg,
  *        new Doc({ id='yyy' })
  *      )
  *        .then((removed) => { // [removedDoc0 .. removedDocN]
  *           ..
  *        })
  *   })
  */
  /**
   * @method
   */
  remove (...msgs) {
    return this.qb.modify(msgs, 'remove')
  }
}

module.exports = CloudParty
