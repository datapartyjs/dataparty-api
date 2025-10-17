const EventEmitter = require('eventemitter3')

const debug = require('debug')('dataparty.match-maker-client')


const dataparty_crypto = require('@dataparty/crypto')
const LokiParty = require('../local/loki-party')
const PeerParty = require('./peer-party')
const MemoryConfig = require('../../config/memory')
const WebsocketComms = require('../../comms/websocket-comms')

const PeerInvite = require('./peer-invite')

class MatchMakerClient extends EventEmitter {
  constructor(identity, contacts, urlOrParty = 'https://postquantum.one/api/', wsUrlOrParty = 'wss://postquantum.one/ws'){

    super()

    
    this.contacts = contacts
    this.sessionKey = null
    this.identity = identity
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

    this.invitesTx = null
    this.invitesRx = null

    this.pendingInvites = {
      tx: {},
      rx: {}
    }
  }



  async start(){
    this.sessionKey = await dataparty_crypto.Identity.fromRandomSeed({id:'ephemeral-session-key'})

    if(!this.restParty){
      let config = new MemoryConfig({
        basePath:'match-maker-client',
        cloud: {
          uri: this.restUrl
        }
      })

      this.restParty = new LokiParty({
        path: 'match-maker-client',
        dbAdapter: new LokiParty.Loki.LokiMemoryAdapter(),
        config
      })

      await this.restParty.setIdentity(this.sessionKey) 

      debug('starting restParty')
      await this.restParty.start()

      if(!this.restParty.comms){
        this.restParty.comms = new Dataparty.Comms.RestComms({
          party:this.restParty,
          config: this.restParty.config
        })

        this.restParty.comms.sessionId = this.sessionKey.key.hash
      }

      await this.announcePublicKeys()
    }

    if(!this.wsParty){
      this.wsParty = new PeerParty({
        comms: new WebsocketComms({
          uri: this.wsUrl,
          discoverRemoteIdentity: false,
          remoteIdentity: await this.restParty.comms.getServiceIdentity(),
          session: this.sessionKey.key.hash
        }),
        config: this.restParty.config
      })

      //if(this.identity){ await this.wsParty.setIdentity(this.identity) }

      await this.wsParty.start()

      debug('starting wsParty')
      await this.wsParty.start()
      debug('waiting for websocket authorization')
      await this.wsParty.comms.authorized()

      this.invitesRx = new this.wsParty.ROSLIB.Topic({
        ros : this.wsParty.comms.ros,
        name : '/invites/' + encodeURIComponent(this.identity.key.hash) + '/rx',
        messageType: 'Object'
      })

      this.invitesRx.subscribe( this.handleInviteRxMsg.bind(this) )


      this.invitesTx = new this.wsParty.ROSLIB.Topic({
        ros : this.wsParty.comms.ros,
        name : '/invites/' + encodeURIComponent(this.identity.key.hash) + '/tx',
        messageType: 'Object'
      })

      this.invitesTx.subscribe( this.handleInviteTxMsg.bind(this) )
    }
    
  }

  async handleInviteRxMsg( msg ){
    debug('handleInviteRxMsg', this.invitesRx.name, msg)

    const inviteId = msg.invite.$meta.id

    if(!this.pendingInvites.rx[inviteId] && msg.invite.state == 'invited'){

      const from = await this.lookupPublicKey(msg.invite.fromHash)
      const to = await this.lookupPublicKey(msg.invite.toHash)

      let invite = new PeerInvite(msg.invite, to, this, from)

      this.pendingInvites.rx[inviteId] = invite

      this.emit('invited', invite)

    } else if(this.pendingInvites.rx[inviteId]) {

      let invite = this.pendingInvites.rx[inviteId]

      debug('calling onInviteMsg')
      await invite.onInviteMsg(msg.invite)
    }
  }

  async handleInviteTxMsg( msg ){
    debug('handleInviteTxMsg', this.invitesTx.name, msg)

    const inviteId = msg.invite.$meta.id
    let pending = this.pendingInvites.tx[inviteId]

    if( pending 
    ){

      debug('calling onInviteMsg')

      await pending.onInviteMsg(msg.invite)

    }
  }


/*

annoucement: {
    created: {
      type: Number,
      required: true
    },
    expiry: {
      type: Number,
      index: true,
      required: true
    },
    sessionKey: PublicKeySchema(true),
    actorKey: PublicKeySchema(false)
  },
  trust: {
    actorSig: {required: true, type: String},   //! base64 of BSON signature
    sessionSig: {required: true, type: String}  //! base64 of BSON signature
  }
}

*/


  async announcePublicKeys(){
    const announceData = {
      annoucement: {
        created: Date.now(),
        expiry: Date.now() + 24*60*60*1000,  //! Set session expiry to 24hr from now
        sessionKey: {
          type: this.sessionKey.key.type,
          hash: this.sessionKey.key.hash,
          public: this.sessionKey.key.public
        },
        actorKey: {
          type: this.identity.key.type,
          hash: this.identity.key.hash,
          public: this.identity.key.public
        }
      },
      trust: {
        actorSig: null,
        sessionSig: null
      }
    }


    const actorSigMsg = await this.identity.sign(announceData.annoucement, true)
    const sessionSigMsg = await this.sessionKey.sign(announceData.annoucement, true)

    debug('actorSigMsg', actorSigMsg)
    debug('sessionSigMsg', sessionSigMsg)

    announceData.trust.actorSig =  dataparty_crypto.Routines.Utils.base64.encode( actorSigMsg.sig )
    announceData.trust.sessionSig = dataparty_crypto.Routines.Utils.base64.encode( sessionSigMsg.sig )

    debug('announcePublicKeys', announceData)

    const announceResult = await this.restParty.comms.call('key/announce', announceData, {
      expectClearTextReply: false,
      sendClearTextRequest: false,
      useSessions: false
    })
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

    const lookupResult = await this.restParty.comms.call('key/lookup', lookupData, {
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

  async createInvite(toHashOrIdentity, {type, service, role, session}, info){

    debug('createInvite')

    let toIdentity = null
    if(typeof toHashOrIdentity == 'string'){
      toIdentity = await this.lookupPublicKey(toHashOrIdentity)
      //this.otherIdentity = toIdentity
    } else {
      toIdentity = toHashOrIdentity
    }

    debug('toIdentity', toIdentity)

    const invitePayload = {
      type: type ? type : 'webrtc',
      service: service ? service : '@dataparty/video-chat',
      role: role ? role : 'client',
      timestamp: (new Date()).getTime(),
      from: this.identity.key.hash,
      to: toIdentity.key.hash,
      session: session ? session : Math.random().toString(36).slice(2),
      info: info ? info : {
        roomId: '',
        action: 'call',
      }
    }

    const secureInvite = await this.identity.encrypt(invitePayload, toIdentity)

    debug('secure-invite', secureInvite)

    const invitePostData = {
      to: toIdentity.key.hash,
      from: this.identity.key.hash,
      payload: JSON.stringify(secureInvite.toJSON())
    }

    const inviteResult = await this.restParty.comms.call('invite/create', invitePostData, {
      expectClearTextReply: false,
      sendClearTextRequest: false,
      useSessions: true
    })

    const inviteDoc = inviteResult.invite

    if(!inviteDoc){ return }

    let invite = new PeerInvite(inviteResult.invite, toIdentity, this, this.identity)

    invite.payload = invitePayload

    this.pendingInvites.tx[inviteDoc.$meta.id] = invite

    invite.once('done', this.removeInvite.bind(this))

    return invite
  }

  async lookupInvites({createdAfter, type='to', id, actorHash  }){
    let actor = this.identity.key.hash

    const lookup = {
      invite: id,
      actor: actorHash ? actorHash : this.identity.key.hash,
      createdAfter,
      type: !type ? 'to' : type
    }

    const lookupResult = await this.restParty.comms.call('invite/lookup', lookup, {
      expectClearTextReply: false,
      sendClearTextRequest: false,
      useSessions: true
    })

    if(!lookupResult.done){
      return null
    }

    return lookupResult.invites
  }

  removeInvite(invite){

    let txInvite = this.pendingInvites.tx[invite.id]
    let rxInvite = this.pendingInvites.rx[invite.id]

    if(txInvite){
      this.pendingInvites.tx[invite.id] = null
      delete this.pendingInvites.tx[invite.id]
    }

    if(rxInvite){
      this.pendingInvites.rx[invite.id] = null
      delete this.pendingInvites.rx[invite.id]
    }
  }

  async getPeerInvitesFromInviteDocs(invites){

    let peerInvites = []

    for(let i=0; i < invites.length; i++){

      const invite = invites[i]
      let to = await this.lookupPublicKey( invite.toHash )
      let from = await this.lookupPublicKey( invite.fromHash )

      let peerInvite = new PeerInvite( invites[i], to, this, from)

      if(peerInvite.isSender()){
        this.pendingInvites.tx[ peerInvite.id ] = peerInvite
      } else {
        this.pendingInvites.rx[ peerInvite.id ] = peerInvite
      }

      peerInvite.once('done', this.removeInvite.bind(this))

      peerInvites.push(peerInvite)
    }

    return peerInvites
  }

  async setInviteState(invite, newState){

    debug('setInviteState')
    let actor = this.identity.key.hash

    const inviteState = {
      invite: invite.inviteDoc.$meta.id,
      //actor,
      state: newState
    }

    const inviteStateResult = await this.restParty.comms.call('invite/set-state', inviteState, {
      expectClearTextReply: false,
      sendClearTextRequest: false,
      useSessions: true
    })

    console.log('setInviteState result', inviteStateResult)

    if(!inviteStateResult.done){
      return null
    }

    return inviteStateResult.invite
  }

  async createShortCode(use_limit=3, expiry){
    debug('createShortCode')

    const request = {
      use_limit,
      expiry: !expiry ? Date.now()+24*60*60*3 : expiry
    }

    const result = await this.restParty.comms.call('short-code/create', request, {
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
    //
  }
}

module.exports = MatchMakerClient
