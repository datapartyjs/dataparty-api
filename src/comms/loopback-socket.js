const debug = require('debug')('dataparty.comms.loopback-socket')
const EventEmitter = require('eventemitter3')

module.exports = class LoopbackSocket extends EventEmitter {
  constructor(channel){
    super()
    this.channel = channel
    this.ready_local = false
    this.ready_remote = false
    this.ready = false
    this.closed = true

    this.channel.on('connected', this.onconnected.bind(this))
    this.channel.on('data', this.ondata.bind(this))
    this.channel.on('close', this.onclose.bind(this))

    
  }

  start(){
    debug('start')
    this.channel.post('connected', true)
    this.ready_local = true
    this.checkConnected()
  }

  checkConnected(){
    if(this.ready_local && this.ready_remote && !this.ready){
      this.ready = true
      this.closed = false
      this.emit('connect', true)
      debug('checkConnected - connected')
    }
    else if(!this.ready){
      this.channel.post('connected', true)
    }
  }

  onconnected(){
    debug('onconnected')
    if(!this.ready_remote){
      this.ready_remote = true
      this.checkConnected()
    }
  }

  onclose(){
    debug('onclose')
    if(this.ready && !this.closed){
      this.ready = false
      this.closed = true
      this.ready_remote = false
      this.ready_local = false

      this.emit('close')
    }
  }

  ondata(msg){
    debug('ondata')
    if(this.ready && !this.closed){
      this.emit('data', msg)
    }
  }

  send(msg){
    debug('send')
    if(this.ready && !this.closed){
      this.channel.post('data', msg)
    }
  }

  destroy(){
    this.close()
    delete this.channel
  }

  close(){
    debug('close')
    if(this.ready && !this.closed){
      this.ready = false
      this.ready_local = false
      this.ready_remote = false
      this.closed = true
      this.channel.post('close', true)
    }
  }
}