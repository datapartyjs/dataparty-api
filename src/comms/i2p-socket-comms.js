const debug = require('debug')('dataparty.comms.i2psocket')

const SAM = require('@diva.exchange/i2p-sam')
const EventEmitter = require('eventemitter3')


const PeerComms = require('./peer-comms')


class I2pStreamShim extends EventEmitter {
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

class I2pSocketComms extends PeerComms {
  constructor({destination, stream, samHost, remoteIdentity, host, party, ...options}){
    super({remoteIdentity, host, party, ...options})

    this.stream = stream
    this.destination = destination
    this.samHost = samHost || { 
      host: '127.0.0.1',
      portTCP: 7656
    }

    if(this.host && !this.stream){
      throw new Error('existing connection expected')
    }

    if(!this.host && (!this.destination && !this.stream)){
      throw new Error('destination or existing stream expected')
    }
  }


  async socketInit(){
    debug('init')
    
    if(!this.host && !this.stream){
      debug('opening client connection to -',this.destination, ' via SAM', JSON.stringify({this.samHost,null,2}))

      this.stream = await SAM.createStream({
        sam: this.samHost,
        stream: { destination: this.destination }
      })

    } else if(this.stream){

      debug('using existing stream', this.stream.getPublicKey())

    }

    this.socket = new I2pStreamShim(this.stream)
  }
}


module.exports = I2pSocketComms