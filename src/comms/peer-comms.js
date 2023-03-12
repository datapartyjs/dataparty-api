const debug = require('debug')('dataparty.comms.peercomms')

const HttpMocks = require('node-mocks-http')

const SocketOp = require('./op/socket-op')
const SocketComms = require('./socket-comms')

const Joi = require('@hapi/joi')
const HostOp = require('./host/host-op')
const HostProtocolScheme = require('./host/host-protocol-scheme')

const AUTH_TIMEOUT_MS = 3000

const HOST_SESSION_STATES = {
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTHED: 'AUTHED',
  SERVER_CLOSED: 'SERVER_CLOSED',
  CLIENT_CLOSED: 'CLIENT_CLOSED'
}

class PeerComms extends SocketComms {
  constructor({remoteIdentity, discoverRemoteIdentity, host, party, socket, ...options}){
    super({remoteIdentity, discoverRemoteIdentity, party, ...options})

    this.socket = socket || null

    this.host = host   //! Is comms host\
    this.oncall = null

    this._host_auth_timeout = null

    if(this.host){
      this.state = PeerComms.STATES.AUTH_REQUIRED
      this.session = undefined
      this.identity = undefined
      this.actor = undefined
    }

    this.pending_calls = 0
  }

  setState(state) {
    this.state = state
    this.emit('state', this.state)
  }

  static get STATES() {
    return HOST_SESSION_STATES
  }

  async handleClientCall(message){

    debug('handleClientCall - pending calls - ', this.pending_calls)

    this.pending_calls++
    try{

      let response = null
      const request = await this.decrypt( {data: message}, this.remoteIdentity )
      debug('handleHostCall', request)

      let inputValidated

      if (this.state === PeerComms.STATES.AUTHED) {
        debug('handling authed call')
        inputValidated = HostProtocolScheme.ANY_OP.validate(request)
      } else if (this.state === PeerComms.STATES.AUTH_REQUIRED) {
        debug('handling non-authed call')
        inputValidated = HostProtocolScheme.AUTH_OP.validate(request)
      } else {
        throw new Error(
          'Recieved input in unexpected session state [',
          this.state,
          ']'
        )
      }

      if(inputValidated.error !== undefined){
        throw inputValidated.error
      }

      debug('original input ->', typeof request, request)
      debug('validated input ->', inputValidated)
      const op = new HostOp({ msg: message, input: inputValidated.value })

      /*debug('session id : ', op.input.session, this.session)

      if (this.session && op.input.session === this.session.id) {
        debug('session id MATCH')
      }*/

      op.once('finished', state => {
        const response = {
          op: 'status',
          id: op.id,
          level: op.level,
          state: op.state,
          stats: {
            start: op.start,
            end: op.end,
            duration_ms: op.end - op.start
          },
          ...op.result 
        }

        this.send(response)
      })


      
      await this.authorizeOperation(op)

    } catch (err) {
      debug('EXCEPTION ->', err)
    }
    this.pending_calls--
  }

  

  async handleClientConnection(){
    debug('handleClientConnection')

    this._host_auth_timeout = setTimeout(
      this.handleAuthTimeout.bind(this),
      AUTH_TIMEOUT_MS
    )
  }

  async handleAuthTimeout(){
    clearTimeout(this._host_auth_timeout)
    this._host_auth_timeout = null
    if(!this.authed){
      debug('handleAuthTimeout - timed out')
      this.authed = false
      await this.stop()
    }
  }

  async handleMessage(message){
    debug('handleMessage', message.toString())

    this.onmessage({data: message})
  }

  async call(path, data, force=false){
    if(this.host && !this.force){ throw new Error('host-not-allowed-call') }
    if(!this.authed){ throw new Error('not authed') }

    if (!this.party.hasIdentity()) {
      throw new Error('identity required')
    }

    let callOp = new SocketOp( 'peer-call', { endpoint: path, data }, this )

    debug('running peer-call endpoint =', path, data)

    const reply = await callOp.run()

    return reply.result
  }

  async start(){
    debug('start')
    if(this.socketInit){
      await this.socketInit()
    }
    
    this.socket.on('close', this.onclose.bind(this))

    if(this.host){
      debug('host mode comms')

      this.socket.once('connect', this.handleClientConnection.bind(this))
      this.socket.on('data', this.handleClientCall.bind(this))
    }
    else{
      debug('client mode comms')
      this.socket.once('connect', this.onopen.bind(this))
      this.socket.on('data', this.handleMessage.bind(this))
    }

    if(this.socketStart){
      await this.socketStart()
    }
  }

  async stop(){
    this.close()
  }

  close(){
    debug('closing connection')
    this.socket.destroy()
  }


  async authorizeOperation(op) {

    debug('Here\'s op', op)
    
    debug('Here state : ', this.state)

    if (op.op === 'auth' && this.state === PeerComms.STATES.AUTH_REQUIRED) {
    
      debug('handling auth op')
      return this.handleAuthOp(op)
    
    } else if (op.op === 'peer-call' && this.state === PeerComms.STATES.AUTHED) {

      return this.handleCallOp(op)

    } else {
      op.result='not implemented'
      op.setState(HostOp.STATES.Finished_Fail)
    }
  }

  async handleAuthOp(op){
    
    debug('allowing client - ', this.remoteIdentity)

    clearTimeout(this._host_auth_timeout)
    this._host_auth_timeout = null

    this.authed = true
    this.setState(PeerComms.STATES.AUTHED)
    op.setState(HostOp.STATES.Finished_Success)

    this.emit('open')
    return 
  }

  async handleCallOp(op){
    debug('peer-call', op.input.endpoint)

    if(this.party.hostRunner){

      debug('calling runner')

      if(op.input.endpoint == 'api-v2-peer-bouncer'){
        debug('ask->',op.input.data)
        op.result = {result: await this.party.handleCall(op.input.data) }

        op.setState(HostOp.STATES.Finished_Success)
        return
      }

      const req = HttpMocks.createRequest({
        method: 'GET',
        url: '/'+op.input.endpoint,
        body: (op.input.data) ? JSON.parse(op.msg.toString()) : undefined
      })

      const res = HttpMocks.createResponse()

      debug('\tthe request', req)

      debug('req ip type', typeof req.ip)

      const route = this.party.hostRunner.router.get(op.input.endpoint)

      debug('route',route)

      debug('call route', await route._events.route({
        method: req.method,
        pathname: req.url,
        request: req,
        response: res
      }))

      op.result = {result: res._getData() }

      debug('got result', op.result)

      op.setState(HostOp.STATES.Finished_Success)
      return

    } else if(op.input.endpoint == 'api-v2-peer-bouncer'){
      
      debug('ask->',op.input.data)
      op.result = {result: await this.party.handleCall(op.input.data) }

      op.setState(HostOp.STATES.Finished_Success)

      return
    }
  }
}


module.exports = PeerComms