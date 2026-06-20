const debug = require('debug')('dataparty.service.host-peer')

class ServiceHostPeer {

  constructor({
    runner,
    matchMaker,
    mediaSrc,
    discoverRemoteIdentity = false
  }){
    this.runner = runner
    this.matchMaker = matchMaker
    this.mediaSrc = mediaSrc
    this.discoverRemoteIdentity = discoverRemoteIdentity
  }

  async start(){
    //

    this.matchMaker.on('invited', this.onInvite.bind(this))
  }

  async onInvite(invite){


    // Filter out none host mode requests
    if(invite.role !== 'host'){
      debug('FAIL - unexpected role[', invite.role, '] we expecte to be host')
      await invite.reject()
      return
    }

    let hostRunner = this.runner.party ? this.runner : this.runner.getRunnerByHostIdentity(invite.to)

    // Make sure we know the requested party & runner
    if(!hostRunner){
      debug('FAIL - requested party not available', invite.to)
      await invite.reject()
      return
    }

    //! Check if party wants to allow user
    if(!(await hostRunner.auth.isSocketConnectionAllowed(invite.from))){
      debug('NOT ALLOWED - user is not allowed', invite.from)
      await invite.reject()
      return
    }


    let hostParty = hostRunner.party

    const peerParty = await invite.accept({
      media: this.mediaSrc,
      hostParty,
      hostRunner,
      discoverRemoteIdentity: this.discoverRemoteIdentity
    })
  }
}

module.exports = ServiceHostPeer