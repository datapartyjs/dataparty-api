const debug = require('debug')('dataparty.comms.loopback-channel')
const EventEmitter = require("eventemitter3")

class PeerNode {
  constructor(peer, name){
    this.name = name
    this.events = new EventEmitter
    this.peer = peer
  }

  post(ns, msg){
    debug('post('+this.name+')', ns, msg)
    this.events.emit(ns, msg)
  }

  on(ns, func){
    debug('on('+this.name+')', ns)
    this.peer.events.on(ns, func)
  }
}

module.exports = class LoopbackChannel {
  constructor(){
    //

    this.peer1 = new PeerNode(undefined, '1')
    this.peer2 = new PeerNode(this.peer1, '2')

    this.peer1.peer = this.peer2
  }
}