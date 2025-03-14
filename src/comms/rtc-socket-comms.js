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
  constructor({remoteIdentity, host, party, wrtc, config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478?transport=udp' }] }, trickle = false, ...options}){
    super({remoteIdentity, host, party, ...options})

    this.rtcSettings = {
      wrtc,
      config,
      trickle,
      initiator: host
    }
  }


  async socketInit(){
    debug('init')
    this.socket = new SimplePeer(this.rtcSettings)
  }
}


module.exports = RTCSocketComms
