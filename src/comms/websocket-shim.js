
const debug = require('debug')('dataparty.comms.websocket-shim')
const EventEmitter = require('eventemitter3')

const WebSocket = global.WebSocket ? global.WebSocket : require('ws')

class WebsocketShim extends EventEmitter {
    constructor(conn){
      super()
      this.conn = conn
  
      this.conn.onmessage = (evt) => {
        this.emit('data', evt.data)
      }
      
      this.conn.onopen = () => {
        debug('shim open')
        setTimeout(()=>{this.emit('connect')}, 1)
      }
      
      this.conn.onclose = (event) => {
        debug('onclose', event)
        this.emit('close', event)
      }
      
      this.conn.onerror = (err) => {
        this.emit('error', err)
      }
  
      if(this.conn.readyState == WebSocket.OPEN){
        setTimeout(()=>{this.emit('connect')}, 1)
      }
  
      debug('connection shim', this.conn.readyState)
    }
  
    close(){
      this.conn.close()
    }
  
    destroy(){
      this.conn.terminate()
    }
  
    send(val){ this.conn.send(val) }
  
  }

  module.exports = WebsocketShim