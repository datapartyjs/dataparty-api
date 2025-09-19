const debug = require('debug')('dataparty.comms.rtcsocketcomms')

const SimplePeer = require('simple-peer')
const PeerComms = require('./peer-comms')

/**
 * @class module:Comms.RTCSocketComms
 * @implements {module:Comms.ISocketComms}
 * @extends {module:Comms.PeerComms}
 * @link module:Comms
 * @see https://en.wikipedia.org/wiki/WebRTC
 */
class RTCSocketComms extends PeerComms {
  constructor({remoteIdentity, host, party, rtcOptions, trickle = false, ...options}){
    super({remoteIdentity, host, party, ...options})

    debug('starting host=',host, ' uuid=', this.uuid)

    this.rtcSettings = {
      trickle,
      initiator: host,
      ...rtcOptions
    }
  }

  static get SimplePeer(){
    return SimplePeer
  }

  async socketInit(){
    debug('init')
    this.socket = new SimplePeer(this.rtcSettings)
  }
}


module.exports = RTCSocketComms
