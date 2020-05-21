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

  constructor ({remoteIdentity, host, wrtc, trickle, ...options}) {
    super(options)

    this.comms = new RTCSocketComms({remoteIdentity, host, party: this, wrtc, trickle})

    this.qb = new Qb({
      call: this.handleCall.bind(this),
      cache: this.cache
    })
  }

  async start(){
    await super.start()
    await this.comms.start()
  }


  async handleCall(ask){
    debug('handleCall')

    if(!this.comms.host){
      return await this.comms.call('api-v2-peer-bouncer', ask)
    }
    else{
      return await this.db.handleCall(ask)
    }
  }
}

module.exports = LocalParty