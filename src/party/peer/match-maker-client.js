const EventEmitter = require('eventemitter3')

const debug = require('debug')('dataparty.match-maker-client')

const dataparty_crypto = require('@dataparty/crypto')
const LokiParty = require('../local/loki-party')
const PeerParty = require('./peer-party')
const MemoryConfig = require('../../config/memory')
const RestComms = require('../../comms/rest-comms')
const WebsocketComms = require('../../comms/websocket-comms')

const PeerInvite = require('./peer-invite')

class MatchMakerClient extends EventEmitter {
  constructor(client){

    super()

    this.client = client

    this.invitesTx = null
    this.invitesRx = null

    this.pendingInvites = {
      tx: {},
      rx: {}
    }

    this.started = false

    this.client.on('connected', this.handleConnect.bind(this))
    this.client.on('disconnected', this.handleDisconnect.bind(this))
  }

  async handleConnect(){
    if(!this.started){ return }

    debug('handleConnect')
    await this.start()
  }

  async handleDisconnect(){
    if(!this.started){ return }

    debug('handleDisconnect')
    this.invitesRx.unsubscribe( this.handleInviteRxMsg.bind(this) )
    this.invitesTx.unsubscribe( this.handleInviteTxMsg.bind(this) )

    this.emit('disconnected')
  }

  async start(){

    this.started = true
    await this.client.start()

    const party = this.client.socketPeerParty

    this.invitesRx = new party.ROSLIB.Topic({
      ros : party.comms.ros,
      name : '/invites/' + encodeURIComponent(this.client.identity.key.hash) + '/rx',
      messageType: 'Object'
    })

    this.invitesRx.subscribe( this.handleInviteRxMsg.bind(this) )


    this.invitesTx = new party.ROSLIB.Topic({
      ros : party.comms.ros,
      name : '/invites/' + encodeURIComponent(this.client.identity.key.hash) + '/tx',
      messageType: 'Object'
    })

    this.invitesTx.subscribe( this.handleInviteTxMsg.bind(this) )

    this.emit('connected')
  }

  async handleInviteRxMsg( msg ){
    debug('handleInviteRxMsg', this.invitesRx.name, msg)

    const inviteId = msg.invite.$meta.id

    if(!this.pendingInvites.rx[inviteId] && msg.invite.state == 'invited'){

      const from = await this.client.lookupPublicKey(msg.invite.fromHash)
      const to = await this.client.lookupPublicKey(msg.invite.toHash)

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


  async createInvite(toHashOrIdentity, {type, service, role, session}, info){

    debug('createInvite')

    let toIdentity = null
    if(typeof toHashOrIdentity == 'string'){
      toIdentity = await this.client.lookupPublicKey(toHashOrIdentity)
    } else {
      toIdentity = toHashOrIdentity
    }

    debug('toIdentity', toIdentity)

    const invitePayload = {
      type: type ? type : 'webrtc',
      service: service ? service : '@dataparty/video-chat',
      role: role ? role : 'client',
      timestamp: (new Date()).getTime(),
      from: this.client.identity.key.hash,
      to: toIdentity.key.hash,
      session: session ? session : Math.random().toString(36).slice(2),
      info: info ? info : {
        roomId: '',
        action: 'call',
      }
    }

    const secureInvite = await this.client.identity.encrypt(invitePayload, toIdentity)

    debug('secure-invite', secureInvite)

    const invitePostData = {
      to: toIdentity.key.hash,
      from: this.client.identity.key.hash,
      payload: JSON.stringify(secureInvite.toJSON())
    }

    const inviteResult = await this.client.socketPeerParty.comms.call('invite/create', invitePostData, {
      expectClearTextReply: false,
      sendClearTextRequest: false,
      useSessions: true
    })

    const inviteDoc = inviteResult.invite

    if(!inviteDoc){ return }

    let invite = new PeerInvite(inviteResult.invite, toIdentity, this, this.client.identity, invitePayload)

    //invite.payload = invitePayload

    this.pendingInvites.tx[inviteDoc.$meta.id] = invite

    invite.once('done', this.removeInvite.bind(this))

    return invite
  }

  async lookupInvites({createdAfter, type='to', id, actorHash  }){
    let actor = this.client.identity.key.hash

    const lookup = {
      invite: id,
      actor: actorHash ? actorHash : this.client.identity.key.hash,
      createdAfter,
      type: !type ? 'to' : type
    }

    const lookupResult = await this.client.socketPeerParty.comms.call('invite/lookup', lookup, {
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
      let to = await this.client.lookupPublicKey( invite.toHash )
      let from = await this.client.lookupPublicKey( invite.fromHash )

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
    let actor = this.client.identity.key.hash

    const inviteState = {
      invite: invite.inviteDoc.$meta.id,
      state: newState
    }

    const inviteStateResult = await this.client.socketPeerParty.comms.call('invite/set-state', inviteState, {
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

}

module.exports = MatchMakerClient
