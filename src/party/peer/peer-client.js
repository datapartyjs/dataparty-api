const EphemeralClient = require("./ephemeral-client")


class PeerClient extends EphemeralClient {
  constructor({config, hostParty, contacts, identity, remoteIdentityHash, matchMaker, service, role='client', rtcSettings}){

    this.config = config
    this.hostParty = hostParty
    this.matchMaker = matchMaker

    this.remoteIdentityHash = remoteIdentityHash

    this.inviteSettings = {
      type: 'webrtc',
      service: service,
      role: role ? role : 'client',
      session: null
    }

    this.rtcSettings = this.rtcSettings

    this.peerParty = null
  }

  async start(mediaSrc){
    //

    if(this.sessionKey){ return }
    this.sessionKey = await dataparty_crypto.Identity.fromRandomSeed({id:'ephemeral-session-key'})
    
    this.inviteSettings.session = this.sessionKey.key.hash

    this.emit('connecting', {time: Date.now()})
    const invite = await this.announcePublicKeys()

    await invite.waitForAccepted()

    this.peerParty = await invite.establish({
      mediaSrc,
      hostParty: this.hostParty,
      config: this.config,
      rtcSettings: this.rtcSettings
    })

    this.emit('connected', {time: Date.now()})

    return this.peerParty
  }

  async rollSessionKey(){
    debug('rollSessionKey')
    this.emit('session-end', {time: Date.now(), session: this.sessionKey.key.hash})

    if(this.peerParty){
      await this.peerParty.stop()
    }

    this.sessionKey = null
    this.peerParty = null

    await this.start()
  }

  async handleClose(){
    //
  }

  async doReconnect(){
    //
  }

  async announcePublicKeys(){
    const announceData = await this.createSessionAnnoucement()

    let invite = await this.matchMaker.createInvite(this.remoteIdentityHash, this.inviteSettings, announceData)

    this.emit('session', {time: Date.now(), session: this.sessionKey.key.hash})

    return invite
  }
  
}

module.exports = PeerClient
