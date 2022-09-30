const axios = require('axios')
const EventEmitter = require('eventemitter3')
const debug = require('debug')('dataparty.comms.rest')

const dataparty_crypto = require('@dataparty/crypto')

const WebsocketComms = require('./websocket-comms')
const AuthError = require('../errors/auth-error')


const DEFAULT_REST_TIMEOUT = 30000


class RestComms extends EventEmitter {
  constructor({ remoteIdentity, config, party }) {
    super()
    this.uri = undefined
    this.wsUri = undefined
    this.cfgPrefix = 'rest'
    this.uriPrefix = ''
    this.config = config
    this.sessionId = undefined
    this.remoteIdentity = remoteIdentity
    this.websocketComm = undefined
    this.party = party

    this.authed = undefined

    // debug(this.uri)
  }

  hasSession() {
    return !!this.sessionId
  }

  async stop() {
    if (this.websocketComm && this.websocketComm.connected) {
      debug('cleaning up websocket')

      this.websocketComm.close()
    }
  }

  async start() {
    await this.loadCloud()
    await this.party.loadIdentity()
    await this.party.loadActor()
    await this.loadSession()

    if (this.authed) {
      return
    }

    if (this.party.hasActor() && this.party.hasIdentity()) {
      if (this.hasSession()) {
        debug('RECOVERING SESSION')
        return this.authRecover().catch(this.allocateSession.bind(this))
      }

      debug('ALLOCATING SESSION')
      return this.allocateSession()
    }

    throw new Error('client needs to be enrolled')
  }

  async loadSession() {
    const path = this.cfgPrefix + '.rest-session'
    const localSessionObj = this.config.read(path)

    if (!localSessionObj) {
      return
    }

    this.sessionId = localSessionObj.id
    await this.storeSession()

    debug('loaded rest session', this.sessionId)
  }

  async loadCloud() {
    this.uri = this.config.read('cloud.uri')
    this.wsUri = this.config.read('cloud.wsUri')

    if (this.uri && this.uri[this.uri.length - 1] !== '/') {
      this.uri = this.uri + '/'
    }
  }

  clearSession() {
    //
  }

  storeSession() {
    const path = this.cfgPrefix + '.rest-session'
    this.config.write(path, { id: this.sessionId })
  }

  async call(path, data, 
    {
      expectClearTextReply = false,
      sendClearTextRequest = false,
      useSessions = true
    } = {}
  ) {
    if (!this.uri) {
      await this.loadCloud()
    }
    if (!this.party.hasIdentity()) {
      throw new Error('identity required')
    }
    await this.getServiceIdentity()

    //const obj = { session: this.sessionId, data: data }

    const fullPath = this.uri + this.uriPrefix + path
    

    let content = null

    if(data || this.useSessions){
      content = {data}
      
      if(useSessions){ content.session = this.sessionId }

      if(!sendClearTextRequest){
        content = await this.party.encrypt(content, this.remoteIdentity)
      }
    }

    debug('call', fullPath, ' req - ', JSON.stringify(content))

    let reply
    try {
      const str = await RestComms.HttpPost(fullPath, content)
      reply = JSON.parse(str)

      // debug('raw reply ->', reply)
    } catch (error) {
      debug('rest', fullPath, ' call fail ->', error.message)
      throw new Error('RestCommsError')
    }

    const msg = await this.party.decrypt(
      reply,
      this.remoteIdentity,
      expectClearTextReply
    )

    debug('call', fullPath, ' res - ', JSON.stringify(msg, null, 2))

    return msg
  }

  async syncActors() {
    const info = await this.call('actor-info')

    debug('syncActors - got info', JSON.stringify(info, null, 2))

    return this.populateActors(info.actor.actors)
  }

  async populateActors(actorRefs) {
    const actorLookups = []
    for (const actorInfo of actorRefs) {
      debug('looking up actor', actorInfo)

      const lookup = this.party
        .find()
        .type(actorInfo.type)
        .id(actorInfo.id)
        .exec()
        .then(docs => {
          if (docs.length === 1) {
            debug('found actor', docs[0])
            return docs[0]
          } else {
            debug('failed to read actor', actorInfo, docs)
          }

          return undefined
        })

      actorLookups.push(lookup)
      // await lookup
      debug('found actor', actorInfo, lookup)
    }

    // return this

    return Promise.all(actorLookups).then(docs => {
      this.party.actors = docs

      return this
    })
  }

  async getServiceIdentity() {
    if (!this.remoteIdentity) {
      if (!this.uri) {
        await this.loadCloud()
      }
      const serverIdentity = await RestComms.HttpGet(this.uri + `${this.uriPrefix}identity`)
      debug('server identity - ', serverIdentity)

      this.remoteIdentity = dataparty_crypto.Identity.fromString(serverIdentity)
    }

    return this.remoteIdentity
  }

  async authorized() {
    await new Promise((resolve, reject) => {
      if (this.authed) {
        return resolve()
      }
      this.once('open', resolve)
      this.once('close', reject)
    })
    return this
  }

  async redeemInvite(code) {
    // await this.party.loadIdentity()
    return this.call('claim-user-invite', {
      short_code: code
    })
  }

  authGitHub(code) {
    // call server endpoint for github oauth
    // store returned session
    if (!this.uri) {
      this.loadCloud()
    }

    return this.party
      .loadIdentity()
      .then(() => {
        return this.call('oauth-github', { code: code })
      })
      .then(sessionInfo => {
        debug(sessionInfo)

        this.sessionId = sessionInfo.session
        this.authed = true

        this.storeSession()
        this.emit('open')

        return this.populateActors(sessionInfo.actor.actors.slice(0, 2)).then(
          () => {
            this.storeSession()
            this.emit('open')
          }
        )
      })
  }

  async authRecover() {
    debug('AUTH RECOVER')
    await this.party.loadActor()
    await this.loadSession()

    if (
      !this.party.actor ||
      !this.party.actor.id ||
      !this.party.actor.type ||
      !this.sessionId
    ) {
      this.authed = false
      debug('session data missing, cannot recover session')
      this.emit('close')
      throw new Error('session data missing')
    }

    debug('syncing actors')

    try {
      await this.syncActors()
      this.authed = true
      this.emit('open')
    } catch (err) {
      debug('auth error', err)
      this.authed = false
      this.emit('close')

      throw new AuthError('auth error')
    }
  }

  async allocateSession() {
    debug('ALLOCATE SESSION')
    this.party.loadActor()

    if (!this.party.actor || !this.party.actor.id || !this.party.actor.type) {
      this.authed = false
      this.emit('close')
      debug('actor data missing, cannot allocate session')
      throw new Error('actor data missing, cannot allocate session')
    }

    debug('actor', this.party.actor)

    try {
      const reply = await this.call('rest-session', {
        actor: {
          id: this.party.actor.id,
          type: this.party.actor.type
        }
      })

      this.sessionId = reply.session
      this.authed = true
      this.storeSession()

      await this.syncActors()
      this.emit('open')
    } catch (err) {
      debug('auth error', err)
      this.authed = false
      this.emit('close')

      throw new AuthError('auth error')
    }
  }

  async websocket(reuse = true) {
    if (reuse && this.websocketComm && this.websocketComm.connected) {
      return this.websocketComm
    }

    return this.call('websocket-session').then(reply => {
      debug(reply)
      if (!this.wsUri) {
        this.loadCloud()
      }

      const comm = new WebsocketComms({
        uri: this.wsUri,
        session: reply.websocket_session,
        identity: this.party._identity,
        remoteIdentity: this.remoteIdentity
      })

      if (reuse) {
        this.websocketComm = comm
      }

      return comm.authorized()
    })
  }

  static async HttpRequest(verb, url, data) {

    debug(`${verb} - ${url}`)

    const response = await axios({
      method: verb,
      url,
      data,
      headers: {'Content-Type': 'application/json'},
      timeout: DEFAULT_REST_TIMEOUT
    })

    return response.data
  }

  static async HttpGet(url) {
    return RestComms.HttpRequest('GET', url)
  }

  static async HttpPost(url, body) {
    return RestComms.HttpRequest('POST', url, body)
  }
}

module.exports = RestComms
