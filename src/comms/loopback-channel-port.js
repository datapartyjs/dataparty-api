const debug=require('debug')('dataparty.comms.loopback-channel-port')
const EventEmitter = require("eventemitter3")

class LoopbackChannelPort {
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

module.exports = LoopbackChannelPort