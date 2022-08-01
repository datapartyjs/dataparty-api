const debug = require('debug')('dataparty.comms.loopback-comms')



const PeerComms = require('./peer-comms')

const LoopbackSocket = require('./loopback-socket')

const AUTH_TIMEOUT_MS = 3000

class LoopbackComms extends PeerComms {
  constructor({remoteIdentity, host, party, channel}){
    super({remoteIdentity, host, party})

    this.channel = channel
  }

  async socketInit(){
    debug('init')
    this.socket = new LoopbackSocket(this.channel)
  }

  async socketStart(){
    debug('start')
    this.socket.start()
  }
}


module.exports = LoopbackComms