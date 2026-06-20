'use strict'

const debug = require('debug')('dataparty.peer-invite')
const EventEmitter = require('eventemitter3')

const dataparty_crypto = require('@dataparty/crypto')

const PeerParty = require('./peer-party')
const RTCSocketComms = require('../../comms/rtc-socket-comms')

const DEFAULT_EXPIRY = 5*60*1000

const END_STATES = [
  'cancelled', 'rejected', 'expired', 'completed'
]

const TURN_PASSWORD='somethingsimple'
const TURN_USERNAME='srs_demo'

const DEFAULT_ICE_SERVERS={
  iceServers: [
    { urls: 'stun:st1.dataparty.xyz:3478'},
    {
      urls:'turns:st1.dataparty.xyz:5349',
      credential: TURN_PASSWORD,
      username: TURN_USERNAME
    }
  ]
}

async function delay(ms){
  return new Promise((resolve,reject)=>{
    setTimeout(resolve, ms)
  })
}

class PeerInvite extends EventEmitter {
  constructor(inviteDoc, toIdentity, matchMakerClient, fromIdentity, payload=null){
    super()

    this.peerParty = null
    this.toIdentity = toIdentity
    this.fromIdentity = fromIdentity
    this.matchMaker = matchMakerClient
    this.inviteDoc = inviteDoc
    this.inviteMsg = null //this.latestDoc = null
    this.payload = payload

    this.topicSub = null
    this.topicPub = null

    this.connected = false

    // host only
    this.offers = []

    this.incomingStream = null

    this.timeoutTimer = null

    this.role = null

    if(this.payload){
      this._updateRole()
      const expiry = this.payload.timestamp + DEFAULT_EXPIRY
      const now = Date.now()

      const delta = expiry - now
      if(delta > 0){
        this.timeoutTimer = setTimeout(this.handleTimeout.bind(this))
      }
    }

    /*if(!this.isSender()){
      this.inviteDoc.
    }*/
  }

  get id(){
    return this.inviteDoc.$meta.id
  }

  get to(){ return this.toIdentity }
  get from(){ return this.fromIdentity }

  _updateRole(){

    if(this.isSender()){

      this.role = this.payload.role
      return

    }

    this.role = this.payload.role == 'client' ? 'host' : 'client'
  }

  isSender(doc){

    if(doc){
      if(doc.toHash == matchMaker.client.identity.key.hash){return false }
      else { return true }
    }

    if(this.inviteDoc.toHash == matchMaker.client.identity.key.hash){return false }
    else { return true }
  }

  async cleanup(){
    //this.removeAllListeners('done')
  }

  async cancel(){
    await this.matchMaker.setInviteState(this, 'cancelled')
    this.emit('done', this)
  }

  async accept({mediaSrc, model, hostParty, hostRunner, discoverRemoteIdentity=false}){
    debug('accepting invite')

    /*if(this.inviteDoc.toHash == this.matchMaker.client.socketPeerParty.identity.key.hash){
        otherIdentity = await this.matchMaker.lookupPublicKey(this.inviteDoc.fromHash)
    } else {
        otherIdentity = await this.matchMaker.lookupPublicKey(this.inviteDoc.toHash)
    }*/

    let changedInvite = await this.matchMaker.setInviteState(this, 'accepted')

    //console.log('pendingCall', changedInvite)

    let msgWorkAround = new dataparty_crypto.Message({})
    msgWorkAround.fromJSON(JSON.parse(changedInvite.payload))

    let payload = await this.matchMaker.client.identity.decrypt(
        msgWorkAround
    )

    this.payload = payload.msg
    this._updateRole()

    /*const expiry = this.payload.timestamp + DEFAULT_EXPIRY
    const now = Date.now()

    const delta = expiry - now
    if(delta > 0 && this.timeoutTimer != null){
      this.timeoutTimer = setTimeout(this.handleTimeout.bind(this))
    }*/

    return await this.establish({mediaSrc, model, hostParty, hostRunner, discoverRemoteIdentity})
  }

  async reject(){
    await this.matchMaker.setInviteState(this, 'rejected')
    this.emit('done', this)
  }

  get state(){
    return (this.inviteMsg || this.inviteDoc).state
  }

  async handleTimeout(){
    await this.matchMaker.setInviteState(this, 'expired')
  }

  async onInviteMsg(inviteMsg){

    debug('onInviteMsg', inviteMsg)
    if(inviteMsg.state == this.inviteDoc.state){ return }
    
    this.inviteMsg = inviteMsg

    debug('\t', 'invite.state = ', inviteMsg.state)
    this.emit(inviteMsg.state, this)

    this.emit('state-change', this)

    if(this.inviteMsg && END_STATES.indexOf(this.inviteMsg.state) ){
      this.emit('done', this)
    }
  }

  async waitForAccepted(){

    if(this.inviteMsg && this.inviteMsg.state == 'accepted'){
      return await Promise.accept()
    }

    if(this.inviteMsg && END_STATES.indexOf(this.inviteMsg.state) ){
      return await Promise.reject()
    }

    return new Promise((resolve,reject)=>{
      this.once('accepted', ()=>{
        resolve()
      })

      this.once('done', ()=>{
        reject()
      })
    })
  }

  async establish({mediaSrc, model, hostParty, hostRunner, rtcSettings, discoverRemoteIdentity=false}){

    if(!rtcSettings){
      rtcSettings = {}
    }

    let host = (this.role == 'host')
    let actorField = this.isSender() ? 'from' : 'to'
    let otherIdentity = this.isSender() ? this.to : this.from

    let party = this.this.matchMaker.client.socketPeerParty

    this.topicSub = new party.ROSLIB.Topic({
      ros : party.comms.ros,
      name : '/invite/' + this.id + '/session/'+(actorField=='to'?'from':'to'),
      messageType: 'Object'
    })

    this.topicPub = new party.ROSLIB.Topic({
      ros : party.comms.ros,
      name : '/invite/' + this.id + '/session/'+actorField,
      messageType: 'Object'
    })

    this.topicSub.subscribe(async (msg)=>{
      debug(this.topicSub.name, ' got message', msg)

      for(let i=0; i<msg.offers.length; i++){

        let msgWorkAround = new dataparty_crypto.Message({})
        msgWorkAround.fromJSON(msg.offers[i])

        let offer = await this.matchMaker.client.identity.decrypt(msgWorkAround)

        if(offer.from.hash != otherIdentity.key.hash){
          debug('BAD IDENTITY')
          continue
        }

        debug('got webrtc offer', offer.msg)
        if(!this.connected && this.peerParty){
          this.peerParty.comms.socket.signal(offer.msg)

          this.emit('signal', {
            invite: this,
            data: offer.msg
          })
        }
      }
    })

    debug('subscribed to - ', this.topicSub.name)

    /*if(this.isSender()){
      await delay(500)
    }*/

    this.peerParty = new PeerParty({
      hostParty,
      hostRunner,
      model: hostParty.factory.model,
      config: hostParty.config,
      comms: new RTCSocketComms({
        host: this.isSender(),
        session: this.payload.session,
        rtcOptions: {
          initiator: this.isSender(),
          stream: mediaSrc,
          //stream: this.isSender() ? mediaSrc : undefined, //false,
          trickle: rtcSettings.trickle? rtcSettings.trickle : true,
          iceTransportPolicy : rtcSettings.iceTransportPolicy  ? rtcSettings.iceTransportPolicy  : 'all',
          allowHalfTrickle: rtcSettings.allowHalfTrickle? rtcSettings.allowHalfTrickle :  true,
          iceCompleteTimeout: rtcSettings.iceCompleteTimeout ? rtcSettings.iceCompleteTimeout : 30*1000,
          config: DEFAULT_ICE_SERVERS
        },
        trickle: rtcSettings.trickle? rtcSettings.trickle : true,
        discoverRemoteIdentity: discoverRemoteIdentity ? discoverRemoteIdentity : false,
        remoteIdentity: discoverRemoteIdentity ? undefined: otherIdentity
      })
    })


    console.log('rtc settings', this.peerParty.comms.rtcSettings)

    await this.peerParty.start()

    this.peerParty.comms.socket.on('connect', connect => {
      this.connected = true
      this.emit('connected')
    })


    this.peerParty.comms.socket.on('stream', stream => {
      this.incomingStream = stream
      this.emit('stream', this)
    })
    

   let sendFreely = false

    this.peerParty.comms.socket.on('signal', async (data)=>{

      if(this.peerParty.comms.authed){ return }

      this.emit('offer', {
        invite: this,
        data
      })

      debug(' >> offer signal trickle', data)


      const secureOffer = await this.matchMaker.client.identity.encrypt(data, otherIdentity)

      if(host && !sendFreely){
        //console.log('am host')
        this.offers.push( secureOffer.toJSON() )
      } else {
        //console.log('am client')
        this.topicPub.publish( {offers: [secureOffer.toJSON()] } )
      }
    })


    if(host){
      console.log('delay')
      await delay(250)
      sendFreely = true

      console.log('sending offers', this.offers)

      //for(let i=0; i < this.offers.length; i++){

        //if(this.peerParty.comms.authed || this.connected){ break }

        this.topicPub.publish( {offers: this.offers} )

        //await delay(1000)

      //}
    } else {

    }

    try{
      debug('waiting for authorized . . .')
      await this.peerParty.comms.authorized()
      debug('authorized!')

      this.emit('authorized', this)


      return this.peerParty

    } catch (err){
      console.log(err)
      throw err
    }
  }

}

module.exports = PeerInvite
