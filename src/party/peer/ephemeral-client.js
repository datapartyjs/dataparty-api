const EventEmitter = require('eventemitter3')

const debug = require('debug')('dataparty.ephemeral-client')

const dataparty_crypto = require('@dataparty/crypto')
const LokiParty = require('../local/loki-party')
const PeerParty = require('./peer-party')
const MemoryConfig = require('../../config/memory')
const RestComms = require('../../comms/rest-comms')
const WebsocketComms = require('../../comms/websocket-comms')

class EphemeralClient extends EventEmitter {
  constructor({identity, role='guest', contacts, urlOrParty = 'https://api.dataparty.xyz/api', wsUrlOrParty = 'wss://api.dataparty.xyz/ws'}){

    super()
    
    this.contacts = contacts
    this.sessionKey = null
    this.identity = identity
    this.role = role || 'guest' //! todo/note - these are different from invite roles
    this.wsParty = null
    this.restParty = null

    if(typeof urlOrParty == 'string'){
      this.restUrl = urlOrParty
      this.restParty = null
    } else {
      this.restParty = urlOrParty
    }

    if(typeof wsUrlOrParty == 'string'){
      this.wsUrl = wsUrlOrParty
      this.wsParty = null
    } else {
      this.wsParty = wsUrlOrParty
    }
  }


  get restParty(){
    return this.restParty
  }

  get socketParty(){
    return this.wsParty
  }


  async start(){
    this.sessionKey = await dataparty_crypto.Identity.fromRandomSeed({id:'ephemeral-session-key'})

    if(!this.restParty){
      let config = new MemoryConfig({
        basePath:'ephemeral-client',
        cloud: {
          uri: this.restUrl
        }
      })

      this.restParty = new LokiParty({
        path: 'ephemeral-client',
        dbAdapter: new LokiParty.Loki.LokiMemoryAdapter(),
        config
      })

      await this.restParty.setIdentity(this.sessionKey) 

      debug('starting restParty')
      await this.restParty.start()

      if(!this.restParty.comms){
        this.restParty.comms = new RestComms({
          party:this.restParty,
          config: this.restParty.config
        })

        this.restParty.comms.sessionId = this.sessionKey.key.hash
      }

      await this.announcePublicKeys()
    }

    if(!this.wsParty && this.wsUrl){

      this.wsParty = new PeerParty({
        comms: new WebsocketComms({
          uri: this.wsUrl,
          discoverRemoteIdentity: false,
          remoteIdentity: await this.restParty.comms.getServiceIdentity(),
          session: this.sessionKey.key.hash
        }),
        config: this.restParty.config
      })

      this.wsParty.comms.on('close', ()=>{

        let stopped = this.wsParty.comms.stopped
        console.log('hey the ws closed - stopped=', stopped)

      })

      await this.wsParty.start()

      debug('starting wsParty')
      await this.wsParty.start()
      debug('waiting for websocket authorization')
      await this.wsParty.comms.authorized()
    }
    
  }

  async createSessionAnnoucement(){
     let currentActor = this.identity
    
    const announceData = {
      annoucement: {
        role: this.role,
        created: Date.now(),
        expiry: Date.now() + 24*60*60*1000,  //! Set session expiry to 24hr from now
        sessionKey: {
          type: this.sessionKey.key.type,
          hash: this.sessionKey.key.hash,
          public: this.sessionKey.key.public
        },
        actorKey: {
          type: currentActor.key.type,
          hash: currentActor.key.hash,
          public: currentActor.key.public
        }
      },
      trust: {
        actorSig: null,
        sessionSig: null
      }
    }


    const actorSigMsg = await currentActor.sign(announceData.annoucement, true)
    const sessionSigMsg = await this.sessionKey.sign(announceData.annoucement, true)

    debug('actorSigMsg', actorSigMsg)
    debug('sessionSigMsg', sessionSigMsg)

    announceData.trust.actorSig =  dataparty_crypto.Routines.Utils.base64.encode( actorSigMsg.sig )
    announceData.trust.sessionSig = dataparty_crypto.Routines.Utils.base64.encode( sessionSigMsg.sig )

    return announceData
  }

  async announcePublicKeys(callPath='key/announce'){

    let currentActor = this.identity
    
    const announceData = {
      annoucement: {
        role: this.role,
        created: Date.now(),
        expiry: Date.now() + 24*60*60*1000,  //! Set session expiry to 24hr from now
        sessionKey: {
          type: this.sessionKey.key.type,
          hash: this.sessionKey.key.hash,
          public: this.sessionKey.key.public
        },
        actorKey: {
          type: currentActor.key.type,
          hash: currentActor.key.hash,
          public: currentActor.key.public
        }
      },
      trust: {
        actorSig: null,
        sessionSig: null
      }
    }


    const actorSigMsg = await currentActor.sign(announceData.annoucement, true)
    const sessionSigMsg = await this.sessionKey.sign(announceData.annoucement, true)

    debug('actorSigMsg', actorSigMsg)
    debug('sessionSigMsg', sessionSigMsg)

    announceData.trust.actorSig =  dataparty_crypto.Routines.Utils.base64.encode( actorSigMsg.sig )
    announceData.trust.sessionSig = dataparty_crypto.Routines.Utils.base64.encode( sessionSigMsg.sig )

    debug('announcePublicKeys', announceData)

    const announceResult = await this.restParty.comms.call(callPath, announceData, {
      expectClearTextReply: false,
      sendClearTextRequest: false,
      useSessions: false
    })

    if(announceResult.done != true){
      throw new Error('annoucement request failed - '+callPath)
    }
  }


  async lookupPublicKey(hash){
    debug('lookupPublicKey - hash:', hash)

    if(hash == this.identity.key.hash){
      return this.identity
    }

    if(this.contacts){
      return await this.contacts.lookupPublicKey(hash)
    }

    const lookupData = { hash }

    const lookupResult = await this.socketParty.comms.call('key/lookup', lookupData, {
      expectClearTextReply: false,
      sendClearTextRequest: false,
      useSessions: true
    })

    if(!lookupResult.done){
      return null
    }

    debug('lookup result -', lookupResult)

    const identity = new dataparty_crypto.Identity({
      key: lookupResult.public_key
    })

    return identity
  }

  async createShortCode(use_limit=3, expiry){
    debug('createShortCode')

    const request = {
      use_limit,
      expiry: !expiry ? Date.now()+24*60*60*3 : expiry
    }

    const result = await this.socketParty.comms.call('short-code/create', request, {
      expectClearTextReply: false,
      sendClearTextRequest: false,
      useSessions: true
    })

    console.log('createShortCode result', result)

    if(!result.done){
      return null
    }

    return result.short_code
  }

  async lookupPublicKeyByShortCode( code ){
    debug('lookupPublicKeyByShortCode')

    const request = { code }

    const result = await this.socketParty.comms.call('short-code/lookup', request, {
      expectClearTextReply: false,
      sendClearTextRequest: false,
      useSessions: true
    })

    console.log('lookupPublicKeyByShortCode result', result)

    if(!result.done){
      return null
    }

    return result.short_code
  }
}

module.exports = EphemeralClient
