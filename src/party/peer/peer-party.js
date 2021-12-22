'use strict'

const debug = require('debug')('dataparty.peer-party')


const Qb = require('../qb')
const IParty = require('../iparty')
const RTCSocketComms = require('../../comms/rtc-socket-comms')

/**
 * @class 
 * @alias module:dataparty.LocalParty
 * @interface
 */
class PeerParty extends IParty {

  constructor ({remoteIdentity, host, hostParty, wrtc, trickle=true, ...options}) {
    super(options)

    this.comms = new RTCSocketComms({remoteIdentity, host, party: this, wrtc, trickle})

    this.qb = new Qb({
      call: this.handleCall.bind(this),
      cache: this.cache
    })

    this.hostParty = null

    if(this.comms.host){
      this.hostParty = hostParty
    }
  }

  async start(){
    await super.start()
    if(this.comms.host){ 
      debug('start - host')
      await this.hostParty.start()
    }
    else {
      debug('start - client')
    }
    await this.comms.start()
  }


  async handleCall(ask){
    debug('handleCall')

    if(this.comms.host){
      debug('handleCall - host')
      return await this.hostParty.handleCall(ask)
    } else {
      debug('handleCall - client')
      return await this.comms.call('api-v2-peer-bouncer', ask)
    }
  }
}

module.exports = PeerParty