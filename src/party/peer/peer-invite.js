'use strict'

const debug = require('debug')('dataparty.peer-invite')
const EventEmitter = require('eventemitter3')

const dataparty_crypto = require('@dataparty/crypto')

const PeerParty = require('./peer-party')
const RTCSocketComms = require('../../comms/rtc-socket-comms')

const END_STATES = [
  'cancelled', 'rejected', 'expired', 'completed'
]

const TURN_PASSWORD='somethingsimple'
const TURN_USERNAME='srs_demo'

async function delay(ms){
  return new Promise((resolve,reject)=>{
    setTimeout(resolve, ms)
  })
}

class PeerInvite extends EventEmitter {
  constructor(inviteDoc, toIdentity, matchMakerClient, fromIdentity){
    super()

    this.peerParty = null
    this.toIdentity = toIdentity
    this.fromIdentity = fromIdentity
    this.matchMaker = matchMakerClient
    this.inviteDoc = inviteDoc
    this.inviteMsg = null //this.latestDoc = null
    this.payload = null

    this.topicSub = null
    this.topicPub = null

    this.connected = false

    // host only
    this.offers = []

    this.incomingStream = null

    /*if(!this.isSender()){
      this.inviteDoc.
    }*/
  }

  get id(){
    return this.inviteDoc.$meta.id
  }

  get to(){ return this.toIdentity }
  get from(){ return this.fromIdentity }

  isSender(doc){

    if(doc){
      if(doc.toHash == matchMaker.wsParty.identity.key.hash){return false }
      else { return true }
    }

    if(this.inviteDoc.toHash == matchMaker.wsParty.identity.key.hash){return false }
    else { return true }
  }

  async cleanup(){
    //this.removeAllListeners('done')
  }

  async cancel(){
    await this.matchMaker.setInviteState(this, 'cancelled')
    this.emit('done', this)
  }

  async accept(mediaSrc){
    debug('accepting invite')

    /*if(this.inviteDoc.toHash == matchMaker.wsParty.identity.key.hash){
        otherIdentity = await this.matchMaker.lookupPublicKey(this.inviteDoc.fromHash)
    } else {
        otherIdentity = await this.matchMaker.lookupPublicKey(this.inviteDoc.toHash)
    }*/

    let changedInvite = await this.matchMaker.setInviteState(this, 'accepted')

    //console.log('pendingCall', changedInvite)

    let msgWorkAround = new dataparty_crypto.Message({})
    msgWorkAround.fromJSON(JSON.parse(changedInvite.payload))

    let payload = await this.matchMaker.wsParty.privateIdentity.decrypt(
        msgWorkAround
    )

    this.payload = payload.msg

    return await this.establish(mediaSrc)
  }

  async reject(){
    await this.matchMaker.setInviteState(this, 'rejected')
    this.emit('done', this)
  }

  get state(){
    return (this.inviteMsg || this.inviteDoc).state
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

  async establish({mediaSrc, hostParty, config}){

    let host = this.isSender()
    let actorField = this.isSender() ? 'from' : 'to'
    let otherIdentity = this.isSender() ? this.to : this.from

    let party = this.matchMaker.wsParty

    this.topicSub = new party.ROSLIB.Topic({
      ros : party.comms.ros,
      name : '/invite/' + this.id + '/session/'+(actorField=='to'?'from':'to'),
      messageType: 'SecureObject'
    })

    this.topicPub = new party.ROSLIB.Topic({
      ros : party.comms.ros,
      name : '/invite/' + this.id + '/session/'+actorField,
      messageType: 'SecureObject'
    })

    this.topicSub.subscribe(async (msg)=>{
      debug(this.topicSub.name, ' got message', msg)

      let msgWorkAround = new dataparty_crypto.Message({})
      msgWorkAround.fromJSON(msg.offer)

      let offer = await party.privateIdentity.decrypt(msgWorkAround)
      
      if(offer.from.hash != otherIdentity.key.hash){
        debug('BAD IDENTITY')
        return
      }
      
      //console.log(offer.msg)
      if(!connected && this.peerParty){
        this.peerParty.comms.socket.signal(offer.msg)
      }
    })

    debug('subscribed to - ', this.topicSub.name)

    this.peerParty = new PeerParty({
      comms: new RTCSocketComms({
        host: this.isSender(),
        session: this.payload.session,
        rtcOptions: {
          initiator: this.isSender(),
          stream: mediaSrc, //false,
          trickle: true,
          allowHalfTrickle: true,
          config: {
            iceServers: [
              { urls: 'stun:st1.dataparty.xyz:3478'},
              {
                urls:'turns:st1.dataparty.xyz:5349',
                credential: TURN_PASSWORD,
                username: TURN_USERNAME
              }
            ]
          }
        },
        trickle: true,
        discoverRemoteIdentity: false,
        remoteIdentity: otherIdentity
      }),
      hostParty: this.isSender() ? hostParty : undefined,
      config: config ? config : hostParty.config
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
    

    this.peerParty.comms.socket.on('signal', async (data)=>{

      if(this.peerParty.comms.authed){ return }

      debug(' >> offer signal trickle', data)


      const secureOffer = await party.privateIdentity.encrypt(data, otherIdentity)

      if(host){
        //console.log('am host')
        this.offers.push({offer: secureOffer.toJSON()})
      } else {
        //console.log('am client')
        this.topicPub.publish({offer: secureOffer.toJSON()})
      }
    })


    if(host){
      console.log('delay')
      await delay(2500)

      console.log('have offers', offers)

      for(let i=0; i < offers.length; i++){

        if(this.peerParty.comms.authed || this.connected){ break }

        this.topicPub.publish( offers[i] )

        await delay(1000)

      }
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
    }
  }

}

module.exports = PeerInvite