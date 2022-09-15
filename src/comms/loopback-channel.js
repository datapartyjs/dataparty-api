const EventEmitter = require("eventemitter3")

class PeerNode {
  constructor(peer){
    this.events = new EventEmitter
    this.peer = peer
  }

  post(ns, msg){
    this.events.emit(ns, msg)
  }

  on(ns, func){
    this.peer.events.on(ns, func)
  }
}

module.exports = class LoopbackChannel {
  constructor(){
    //

    this.peer1 = new PeerNode()
    this.peer2 = new PeerNode(this.peer1)

    this.peer1.peer = this.peer2
  }
}