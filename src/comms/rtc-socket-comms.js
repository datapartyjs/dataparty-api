const debug = require('debug')('dataparty.comms.rtcsocketcomms')

const SimplePeer = require('simple-peer')
const PeerComms = require('./peer-comms')

const AUTH_TIMEOUT_MS = 3000

class RTCSocketComms extends PeerComms {
  constructor({remoteIdentity, host, party, wrtc, trickle = false}){
    super({remoteIdentity, host, party})

    this.rtcSettings = {
      wrtc,
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