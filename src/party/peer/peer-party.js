'use strict'

const debug = require('debug')('dataparty.peer-party')

const Qb = require('../qb')
const IParty = require('../iparty')

/**
 * @class 
 * @alias module:dataparty.LocalParty
 * @interface
 */
class PeerParty extends IParty {

  constructor ({comms, hostParty, hostRunner, qbOptions={debounce: 10, find_dedup:true, timeout: 10000}, ...options}) {
    super(options)

    this.comms = comms

    this.comms.party = this

    this.qb = new Qb({
      call: this.handleCall.bind(this),
      cache: this.cache,
      ...qbOptions
    })

    this.hostParty = null
    this.hostRunner = null

    if(this.comms.host){
      this.hostParty = hostParty
      this.hostRunner = hostRunner
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
