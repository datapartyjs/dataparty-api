const debug = require('debug')('dataparty.comms.rtcsocketcomms')

const SimplePeer = require('simple-peer')

const SocketOp = require('./op/socket-op')
const SocketComms = require('./socket-comms')

class RTCSocketComms extends SocketComms {
  constructor({remoteIdentity, host, party, wrtc, trickle = false}){
    super({remoteIdentity, party})

    this.socket = null

    this.rtcSettings = {
      wrtc,
      trickle,
      initiator: host
    }

    this.host = host
    this.party = party
    this.oncall = null
  }

  async handleHostCall({path, data}){
    debug('handleHostConnection')
    //return await this.oncall({path, data})
  }

  async handleHostConnection(){
    debug('handleHostConnection')
  }

  async handleAuthTimeout(){
    if(!this.authed){
      debug('handleAuthTimeout - timed out')
      this.authed = false
      this.peer.close()
    }
  }

  async call(path, data){
    if(this.host){ throw new Error('host-not-allowed-call') }
    if(!this.authed){ throw new Error('not authed') }

    if (!this.party.hasIdentity()) {
      throw new Error('identity required')
    }

    let callOp = new SocketOp( 'peer-call', { _endpoint: path, ...data }, this )

    debug('peer-call endpoint =', path, data)

    return await callOp.run()
  }

  async start(){

    this.socket = new SimplePeer(this.rtcSettings)

    this.socket.on('close', this.onclose.bind(this))

    if(this.host){
      this.socket.on('connect', this.handleHostConnection.bind(this))
      this.socket.on('data', this.handleHostCall.bind(this))
    }
    else{
      this.socket.on('connect', this.onopen.bind(this))
      this.socket.on('data', this.onmessage.bind(this))
    }
  }

  async stop(){
    this.socket.stop()
  }



}


module.exports = RTCSocketComms