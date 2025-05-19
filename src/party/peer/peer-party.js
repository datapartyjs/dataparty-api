'use strict'

const debug = require('debug')('dataparty.peer-party')

const Qb = require('../qb')
const IParty = require('../iparty')

const LocalTopicHost = require('../../topics/local-topic-host')


class PeerParty extends IParty {

  /**
 * @class  module:Party.PeerParty
 * @extends {module:Party.IParty}
 * @link module.Party
 * 
 * @param {module:Comms.ISocketComms}   options.comms
 * @param {boolean}                     options.hostParty Is this instance the host of the peer connection?
 * @param {module:Service.HostRunner}   options.hostRunner
 * @param {Integer}                     options.qbOptions.debounce    Amount of milliseconds to wait before sending a query. More than one query can be sent to the server in a single exchange. This defaults to 10ms.
 * @param {boolean}                     options.qbOptions.find_dedup  Set if duplicate queries should be merged into a single network request. Defaults to `true`
 * @param {Integer}                     options.qbOptions.timeout     Time in milliseconds before a query is considered timedout. Defaults to 10seconds
 */
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
      debug('host')
      this.hostParty = hostParty
      this.hostRunner = hostRunner
      this.topics = hostParty.topics || new LocalTopicHost()

      if(!this.topics.party){
        this.topics.party = this
      }
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
