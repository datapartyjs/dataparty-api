const debug = require('debug')('dataparty.comms.rtcsocketcomms')

const SimplePeer = require('simple-peer')
const PeerComms = require('./peer-comms')


class RTCSocketComms extends PeerComms {
  constructor({remoteIdentity, host, party, wrtc, trickle = false, ...options}){
    super({remoteIdentity, host, party, ...options})

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