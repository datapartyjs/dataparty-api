const debug = require('debug')('dataparty.comms.loopback-comms')

const PeerComms = require('./peer-comms')
const LoopbackSocket = require('./loopback-socket')

const AUTH_TIMEOUT_MS = 3000


/**
 * @class module:Comms.LoopbackComms
 * @implements {module:Comms.PeerComms}
 * @link module:Comms
 * @param {module:Comms.LoopbackChannelPort} channel 
 */
class LoopbackComms extends PeerComms {

  constructor({remoteIdentity, host, party, channel, ...options}){
    super({remoteIdentity, host, party, ...options})

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