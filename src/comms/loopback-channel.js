const debug = require('debug')('dataparty.comms.loopback-channel')
const EventEmitter = require("eventemitter3")


const LoopbackChannelPort = require('./loopback-channel-port')

/**
 * @class module:Comms.LoopbackChannel
 * @implements {module:Comms.ISocketComms}
 * @extends {module:Comms.ISocketComms}
 * @link module:Comms
 */
module.exports = class LoopbackChannel {
  constructor(){

    //! The first channel peer
    this.port1 = new LoopbackChannelPort(undefined, '1')

    //! The second channel peer
    this.peer2 = new LoopbackChannelPort(this.port1, '2')

    this.port1.peer = this.port2
  }
}