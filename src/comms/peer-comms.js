
const {Routines, Identity, AESStream} = require('@dataparty/crypto')
const debug = require('debug')('dataparty.comms.peercomms')
const uuidv4 = require('uuid/v4')
const HttpMocks = require('node-mocks-http')

const SocketOp = require('./op/socket-op')
const ISocketComms = require('./isocket-comms')

const Joi = require('joi')
const HostOp = require('./host/host-op')
const HostProtocolScheme = require('./host/host-protocol-scheme')

const AUTH_TIMEOUT_MS = 25000

const HOST_SESSION_STATES = {
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTHED: 'AUTHED',
  SERVER_CLOSED: 'SERVER_CLOSED',
  CLIENT_CLOSED: 'CLIENT_CLOSED'
}


function truncateString(str, num) {

  if(!str){return ''}
  
  if(typeof str != 'string'){
    str = str.toString()
  }

  let length = str.length

  if (str.length <= num) {
    return str
  }
  return str.slice(0, num) + '...' + (length-num) + 'more bytes'
}


/**
 * @class module:Comms.PeerComms
 * @implements {module:Comms.ISocketComms}
 * @extends {module:Comms.ISocketComms}
 * @link module:Comms
 * 
 * 
 * @param {boolean}     host    Set to `true` to make this peer act as the protocol host
 * @param {Object}      socket  Already connected peer socket
 */
class PeerComms extends ISocketComms {
  constructor({remoteIdentity, discoverRemoteIdentity, host, party, socket, ...options}){
    super({remoteIdentity, discoverRemoteIdentity, party, ...options})

    this.uuid = uuidv4()
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
    debug('state -', state)
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
      let request = await this.decrypt( {data: message}, this.remoteIdentity )
      debug('handleHostCall', truncateString(request, 1024))

      let inputValidated

      if (this.state === PeerComms.STATES.AUTHED) {

        if(typeof request != 'object'){
          request = JSON.parse(request)
        }

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

      //debug('original input ->', typeof request, request)
      //debug('validated input ->', inputValidated)
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

        debug('finished', response.id, response.state, response.stats.duration_ms, 'ms')

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
    debug('handleMessage', truncateString(message.toString(), 1024) )

    this.onmessage({data: message})
  }

  async call(path, data, force=false){
    if(this.host && !this.force){ throw new Error('host-not-allowed-call') }
    if(!this.authed){ throw new Error('not authed') }

    if (!this.party.hasIdentity()) {
      throw new Error('identity required')
    }

    let callOp = new SocketOp( 'peer-call', { endpoint: path, data }, this )

    debug('running peer-call endpoint =', path, truncateString(data, 1024))

    const reply = await callOp.run()

    return reply.result
  }

  async start(){
    debug('start')
    if(this.socketInit){
      await this.socketInit()
    }
    
    this.socket.on('close', this.stop.bind(this))

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
    debug('stop')
    this.close()
  }

  async close(event){
    debug('close', this.uuid, event)

    if(this.party.topics){
      await this.party.topics.destroyNode(this)
    }

    debug('closing connection')
    this.socket.destroy()

    this.onclose()
  }


  async authorizeOperation(op) {

    //debug('Here\'s op', op)
    
    //debug('state : ', this.state)

    //console.log(op.input)

    if (op.op === 'auth' && this.state === PeerComms.STATES.AUTH_REQUIRED) {
    
      debug('handling auth op')
      return this.handleAuthOp(op)
    
    } else if (op.op === 'peer-call' && this.state === PeerComms.STATES.AUTHED) {

      return this.handleCallOp(op)

    } else if (op.op === 'advertise' && this.state === PeerComms.STATES.AUTHED) {

      if(this.party.topics){

        let topicAndArgs = await this.party.hostRunner.getTopic(op.input.topic)

        debug('advertise', op.input.topic)
        
        debug(topicAndArgs)

        if(!topicAndArgs){
          op.setState(HostOp.STATES.Finished_Fail)
        } else {
          let can = await topicAndArgs.topic.canAdvertise(this.remoteIdentity, topicAndArgs.arguments)

          if(!can){
            op.setState(HostOp.STATES.Finished_Permission_Denied)
          } else {
            await this.party.topics.advertise(this, op.input.topic)
            op.setState(HostOp.STATES.Finished_Success)
          }
        }
      }
      else{
        op.setState(HostOp.STATES.Finished_Fail)
      }

    } else if (op.op === 'subscribe' && this.state === PeerComms.STATES.AUTHED) {

      if(this.party.topics){

        let topicAndArgs = await this.party.hostRunner.getTopic(op.input.topic)

        debug('subscribe', op.input.topic)
        
        debug(topicAndArgs)

        if(!topicAndArgs){
          op.setState(HostOp.STATES.Finished_Fail)
        } else {
          let can = await topicAndArgs.topic.canSubscribe(this.remoteIdentity, topicAndArgs.arguments)

          if(!can){
            op.setState(HostOp.STATES.Finished_Permission_Denied)
          } else {
            await  this.party.topics.subscribe.bind(this.party.topics)(this, op.input.topic)
            op.setState(HostOp.STATES.Finished_Success)
          }
        }
      }
      else{
        op.setState(HostOp.STATES.Finished_Fail)
      }

    } else if (op.op === 'unsubscribe' && this.state === PeerComms.STATES.AUTHED) {

      if(this.party.topics){
        await this.party.topics.unsubscribe(this, op.input.topic)
        op.setState(HostOp.STATES.Finished_Success)
      }
      else{
        op.setState(HostOp.STATES.Finished_Fail)
      }

    } else if (op.op === 'publish' && this.state === PeerComms.STATES.AUTHED) {

      if(this.party.topics){

        let topicAndArgs = await this.party.hostRunner.getTopic(op.input.topic)

        debug('publish', op.input.topic)

        if(!topicAndArgs){
          op.setState(HostOp.STATES.Finished_Fail)
        } else {
          let can = await topicAndArgs.topic.canPublish(this.remoteIdentity, topicAndArgs.arguments)

          if(!can){
            op.setState(HostOp.STATES.Finished_Permission_Denied)
          } else {
            await this.party.topics.publish(this, op.input.topic, op.input.msg)
            op.setState(HostOp.STATES.Finished_Success)
          }
        }

      }
      else{
        op.setState(HostOp.STATES.Finished_Fail)
      }

    } else {
      debug('⚠️ op not implemented ⚠️')
      debug(op.input)

      op.result='not implemented'
      op.setState(HostOp.STATES.Finished_Fail)
    }
  }

  async handleAuthOp(op){

    debug('handleAuthOp -', op)

    const offerBSON = Routines.BSON.serializeBSONWithoutOptimiser( op.input.offer )
    const offer = {
      sender: new Identity(op.input.offer.sender),
      pqCipherText: op.input.offer.pqCipherText,
      streamNonce: op.input.offer.streamNonce,
      mode: op.input.offer.mode
    }

    const signature = {
      timestamp: op.input.signature.timestamp,
      type: op.input.signature.type,
      value: Routines.Utils.base64.decode( op.input.signature.value )
    }

    const computedHash = await Routines.hashKey( offer.sender.key )
    debug('computed hash -', computedHash)
    if(computedHash != offer.sender.key.hash){ throw new Error('DENY - sender key hash is not valid!') }

    if(this.party.hostRunner){
      const actor = await this.party.hostRunner.auth.lookupIdentity(offer.sender)
      const verified = await Routines.verifyDataPQ(actor, signature, offerBSON)
      
      if(!verified){
        throw new Error('DENY(hostRunner) - auth op signature is not valid')
      }

      if(this.discoverRemoteIdentity){ this.remoteIdentity = actor }
      
      const authorized = await this.party.hostRunner.auth.isSocketConnectionAllowed(actor)
      if(!authorized){

        clearTimeout(this._host_auth_timeout)
        this._host_auth_timeout = null

        this.authed = false
        this.setState(PeerComms.STATES.SERVER_CLOSED)
        op.setState(HostOp.STATES.Finished_Success)

        await this.stop()

        debug('DENY - client not allowed - ', this.remoteIdentity)
      }
    } else {
      const actor = offer.sender
      const verified = await Routines.verifyDataPQ(actor, signature, offerBSON)
      
      if(!verified){ throw new Error('DENY - auth op signature is not valid') }

      if(this.discoverRemoteIdentity){
        this.remoteIdentity = actor
      } else if(this.remoteIdentity.key.hash != actor.key.hash){
        throw new Error('DENY - auth op sender does not match expected remote')
      }
    }
    
    debug('clienr auth op offer -', offer)
    debug('ALLOW - allowing client - ', this.remoteIdentity)

    //this.aesStream = await this.party.privateIdentity.recoverStream(offer, true)

    this.aesStream = await AESStream.recoverStream(
      this.party.privateIdentity,
      offer,
      true
    )

    debug('aes-stream', this.aesStream)

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

      if(op.input.endpoint == 'api-v2-peer-bouncer' && await this.party.hostRunner.auth.isAdmin(this.remoteIdentity)){
        debug('ask->', truncateString(op.input.data, 1024))
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

    } else if(op.input.endpoint == 'api-v2-peer-bouncer' && await this.party.hostRunner.auth.isAdmin(this.remoteIdentity)){
      
      debug('ask->',op.input.data)
      op.result = {result: await this.party.handleCall(op.input.data) }

      op.setState(HostOp.STATES.Finished_Success)

      return
    }
  }
}


module.exports = PeerComms
