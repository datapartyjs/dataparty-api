const debug = require('debug')('dataparty.comms.i2psocket')
const debugShim = require('debug')('dataparty.comms.i2psocket-shim')

const SAM = require('@diva.exchange/i2p-sam')
const EventEmitter = require('eventemitter3')


const PeerComms = require('./peer-comms')


class I2pStreamShim extends EventEmitter {
  constructor(stream){
    super()
    this.stream = stream

    this.stream.on('data',data=>{
      this.emit('data', data)
    })

    this.stream.on('error',err=>{
      this.emit('error', err)
    })

    this.stream.once('close',()=>{
      this._isConnected = false
      this.emit('close')
    })

    this.stream.once('stream',()=>{
      this._isConnected = true
      debugShim('shim open')
      setTimeout(()=>{this.emit('connect')}, 1)
    })


    if(this.stream.hasStream){
      this._isConnected = true
      debugShim('has stream')
      setTimeout(()=>{this.emit('connect')}, 1)
    }
  }

  get isConnected(){
    return this._isConnected
  }

  async connect(){
    debugShim('connecting to ', this.stream.destination)
    return await this.stream.connect()
  }

  close(){
    this._closed = true
    this.stream.close()
  }

  destroy(){
    if(!this._closed){
      this.close()
    }
  }

  send(val){ this.stream.send(val) }

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

    if( !this.socket.isConnected ){

      await this.socket.connect()

    }
  }
}


module.exports = I2pSocketComms