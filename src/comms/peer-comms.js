const debug = require('debug')('dataparty.comms.peercomms')


const SocketOp = require('./op/socket-op')
const SocketComms = require('./socket-comms')

const AUTH_TIMEOUT_MS = 3000

class PeerComms extends SocketComms {
  constructor({remoteIdentity, host, party, socket}){
    super({remoteIdentity, party})

    this.socket = socket || null

    this.host = host
    this.party = party
    this.oncall = null

    this._host_auth_timeout = null
  }

  async handleClientCall(message){
    let response = null
    const request = await this.decrypt( {data: message}, this.remoteIdentity )
    debug('handleHostCall', request)

    if(!this.authed){
      if(request.op == 'auth'){
        debug('allowing client')
        response = {
          op: 'status',
          id: request.id,
          level: 'Info',
          state: 'Finished_Success'
        }
        
        clearTimeout(this._host_auth_timeout)
        this._host_auth_timeout = null

        this.authed = true
        this.emit('open')
        this.send(response)
      }

      return
    }

    if (request.op == 'peer-call') {
      debug('peer-call')
      if(request.endpoint == 'api-v2-peer-bouncer'){
        debug('ask->',request.data)
        this.send({
          op: 'status',
          id: request.id,
          state: 'Finished_Success',
          ...await this.party.handleCall(request.data)
        })
      }
    }
  }

  

  async handleClientConnection(){
    debug('handleHostConnection')

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

  async call(path, data){
    if(this.host){ throw new Error('host-not-allowed-call') }
    if(!this.authed){ throw new Error('not authed') }

    if (!this.party.hasIdentity()) {
      throw new Error('identity required')
    }

    let callOp = new SocketOp( 'peer-call', { endpoint: path, data }, this )

    debug('running peer-call endpoint =', path, data)

    return await callOp.run()
  }

  async start(){
    debug('start')
    if(this.socketInit){
      await this.socketInit()
    }
    this.socket.on('close', this.onclose.bind(this))

    if(this.host){
      this.socket.on('connect', this.handleClientConnection.bind(this))
      this.socket.on('data', this.handleClientCall.bind(this))
    }
    else{
      this.socket.on('connect', this.onopen.bind(this))
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
    debug('Client closing connection')
    this.socket.destroy()
}



}


module.exports = PeerComms