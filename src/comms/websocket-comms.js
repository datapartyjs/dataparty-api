const debug = require('debug')('dataparty.comms.websocket')

const WebSocket = require('ws')
const EventEmitter = require('eventemitter3')


const PeerComms = require('./peer-comms')


class WebsocketShim extends EventEmitter {
  constructor(conn){
    super()
    this.conn = conn

    this.conn.onmessage = (evt) => {
      this.emit('data', evt.data)
    }
    
    this.conn.onopen = () => {
      debug('shim open')
      this.emit('connect')
    }
    
    this.conn.onclose = () => {
      this.emit('close')
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

class WebsocketComms extends PeerComms {
  constructor({uri, connection, remoteIdentity, host, party, ...options}){
    super({remoteIdentity, host, party, ...options})

    this.uri = uri
    this.connection = connection

    if(this.host && !this.connection){
      throw new Error('existing connection expected')
    }

    if(!this.host && (!this.uri && !this.connection)){
      throw new Error('uri or existing connection expected')
    }
  }


  async socketInit(){
    debug('init')
    
    if(!this.host && !this.connection){
      debug('opening client connection to',this.uri)
      this.connection = new WebSocket(this.uri)
    }

    this.socket = new WebsocketShim(this.connection)
  }
}


module.exports = WebsocketComms