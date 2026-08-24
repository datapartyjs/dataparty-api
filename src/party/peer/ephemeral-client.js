const EventEmitter = require('eventemitter3')

const debug = require('debug')('dataparty.ephemeral-client')

const dataparty_crypto = require('@dataparty/crypto')
const LokiParty = require('../local/loki-party')
const PeerParty = require('./peer-party')
const MemoryConfig = require('../../config/memory')
const RestComms = require('../../comms/rest-comms')
const WebsocketComms = require('../../comms/websocket-comms')

const MAX_RECONNECT_INTERVAL = 120*1000
const MIN_RECONNECT_INTERVAL = 9*1000
const MIN_BACKOFF = 9*1000

const MAX_SESSION_AGE = 24*60*60*1000  //! Set session expiry to 24hr from now
const SESSION_ROLL_AGE = Math.round(MAX_SESSION_AGE * 0.75)

function getReconnectInterval(count, backoff=9000){
  return Math.max(
    MIN_RECONNECT_INTERVAL,
    Math.min(
      MAX_RECONNECT_INTERVAL,
      Math.round(MIN_BACKOFF + (count * Math.max(backoff, MIN_BACKOFF) * Math.random()))
    )
  )
}

class EphemeralClient extends EventEmitter {
  constructor({identity, role='guest', autoreconnect=true, contacts, urlOrParty = 'https://mm.dataparty.xyz', wsUrlOrParty = 'wss://mm.dataparty.xyz/ws', allowSelfSigned = false} = {}){

    super()
    
    this.allowSelfSigned = allowSelfSigned
    this.contacts = contacts
    this.sessionKey = null
    this.sessionExpiry = null
    this.sessionTimer = null
    this.identity = identity
    this.role = role || 'guest' //! todo/note - these are different from invite roles
    this.wsParty = null
    this.restParty = null
    this.autoreconnect = autoreconnect
    this.backoff = MIN_BACKOFF

    this.reconnectTimer = null

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

    this.reconnect_last_attempt = null
    this.reconnect_tries = 0
  }

  get socketParty(){
    return this.wsParty
  }


  async start(){
    if(this.sessionKey){ return }
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
          config: this.restParty.config,
          allowSelfSigned: this.allowSelfSigned
        })

        this.restParty.comms.sessionId = this.sessionKey.key.hash
      }

      await this.announcePublicKeys()
    }

    if(!this.wsParty && this.wsUrl){
      this.emit('connecting', {time: Date.now()})
      this.wsParty = new PeerParty({
        comms: new WebsocketComms({
          uri: this.wsUrl,
          discoverRemoteIdentity: false,
          remoteIdentity: await this.restParty.comms.getServiceIdentity(),
          session: this.sessionKey.key.hash,
          allowSelfSigned: this.allowSelfSigned
        }),
        config: this.restParty.config
      })

      this.wsParty.comms.on('server-close', this.handleWsClose.bind(this))
      this.wsParty.comms.on('timeout', this.handleWsClose.bind(this))
      this.wsParty.comms.on('error', this.handleWsClose.bind(this))

      debug('starting wsParty')
      await this.wsParty.start()
      debug('waiting for websocket authorization')
      await this.wsParty.comms.authorized()
      this.emit('connected', {time: Date.now()})
    }
    
  }

  async stop(){
    await this.wsParty.stop()
  }

  get socketPeerParty(){
    return this.wsParty
  }

  async checkSessionExpiry(){
    if(!this.sessionKey){ return }

    const now = Date.now()

    if(this.sessionExpiry <= now){
      await this.rollSessionKey()
    }
  }

  async rollSessionKey(){

    debug('rollSessionKey')
    this.emit('session-end', {time: Date.now(), session: this.sessionKey.key.hash})

    if(this.wsParty){
      await this.wsParty.stop()
    }

    this.sessionKey = null
    this.restParty = null
    this.wsParty = null

    await this.start()
  }

  async handleWsClose(){

    this.emit('disconnected', {time: Date.now()})

    let stopped = this.wsParty.comms.stopped

    if(stopped){ return }

    const sleepTime = getReconnectInterval(this.reconnect_tries, this.backoff)
    debug('ws closed with stopped=',stopped, '   waiting ', sleepTime/1000,'sec')
    
    if(!this.reconnectTimer){

      this.emit('reconnecting', {sleepTime, wakeTime: Date.now()+sleepTime})

      this.reconnectTimer = setTimeout(
        this.doReconnect.bind(this),
        sleepTime
      )
    }
  }

  async doReconnect(){
    let stopped = this.wsParty.comms.stopped

    this.reconnectTimer = null

    if(stopped || !this.wsParty || !this.autoreconnect){ debug('skip reconnect'); return }

    debug('doing ws reconnect...')

    this.reconnect_last_attempt = Date.now()
    this.reconnect_tries++

    try{
      this.emit('connecting', {time:Date.now()})
      this.wsParty.comms = new WebsocketComms({
        uri: this.wsUrl,
        discoverRemoteIdentity: false,
        remoteIdentity: await this.restParty.comms.getServiceIdentity(),
        session: this.sessionKey.key.hash,
        allowSelfSigned: this.allowSelfSigned
      })

      this.wsParty.comms.party = this.wsParty

      this.wsParty.comms.on('server-close', this.handleWsClose.bind(this))
      this.wsParty.comms.on('timeout', this.handleWsClose.bind(this))
      this.wsParty.comms.on('error', this.handleWsClose.bind(this))

      debug('restarting websocket')
      await this.wsParty.comms.start()
      debug('waiting for websocket authorization')
      await this.wsParty.comms.authorized()

      
      debug('connected and authorized')

      this.reconnect_last_attempt = null
      this.reconnect_tries = 0

      this.emit('connected', {time:Date.now()})
      this.emit('reconnected', {time:Date.now()})

    } catch(err){
      debug('reconnect error', err)

      
      this.handleWsClose()
    }
  }


  async createSessionAnnoucement(){
    let currentActor = this.identity

    const now = Date.now()
    this.sessionExpiry = now + MAX_SESSION_AGE
    
    this.sessionTimer = setTimeout(
      this.rollSessionKey.bind(this),
      SESSION_ROLL_AGE
    )
    
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


    announceData.trust.actorSig =  dataparty_crypto.Routines.Utils.base64.encode( actorSigMsg.sig )
    announceData.trust.sessionSig = dataparty_crypto.Routines.Utils.base64.encode( sessionSigMsg.sig )

    return announceData
  }

  async announcePublicKeys(callPath='key/announce'){


    const announceData = await this.createSessionAnnoucement()


    debug('announcePublicKeys', announceData)

    const announceResult = await this.restParty.comms.call(callPath, announceData, {
      expectClearTextReply: false,
      sendClearTextRequest: false,
      useSessions: false
    })

    if(announceResult.done != true){
      throw new Error('annoucement request failed - '+callPath)
    }

    this.emit('session', {time: Date.now(), session: this.sessionKey.key.hash})
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