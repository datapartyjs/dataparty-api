const debug = require('debug')('dataparty.service.host-peer')

class ServiceHostPeer {

  constructor({
    runner,
    matchMaker,
    mediaSrc

  }){
    this.runner = runner
    this.matchMaker = matchMaker

    this.mediaSrc = mediaSrc
  }

  async start(){
    //

    this.matchMaker.on('invited', this.onInvite.bind(this))
  }

  async onInvite(invite){
    //

    //! check if service wants to allow user

    const peerParty = await invite.accept(this.mediaSrc,this.config)
  }
}

module.exports = ServiceHostPeer