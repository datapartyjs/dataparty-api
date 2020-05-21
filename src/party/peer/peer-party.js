class RTCPeer {}
class SerialPeer {}



class PeerParty {
  constructor({peer, initiator, }){

  }
}


class WebRTCRestComms {
  constructor({peerIdentity, initiator, wrtc, trickle = false}){
    this.peer = new SimplePeer({
      wrtc,
      trickle,
      initiator
    })

    this.host = initiator
    this.oncall = null
  }

  async handleCall({path, data}){
    return await this.oncall({path, data})
  }

  async call(path, data, expectClearTextReply = false){
    //
  }

  async start(){

  }

  async stop(){

  }

  

}
