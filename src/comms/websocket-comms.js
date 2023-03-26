const debug = require('debug')('dataparty.comms.websocket')

const WebSocket = global.WebSocket ? global.WebSocket : require('ws')

const PeerComms = require('./peer-comms')

const WebsocketShim = require('./websocket-shim')

/**
 * @class module:Comms.WebsocketComms
 * @implements {module:Comms.ISocketComms}
 * @extends {module:Comms.PeerComms}
 * @link module:Comms
 * @see https://en.wikipedia.org/wiki/WebSocket
 */
class WebsocketComms extends PeerComms {
  constructor({uri, connection, remoteIdentity, host, party, ...options}){
    super({remoteIdentity, host, party, ...options})

    this.uri = uri
    this.connection = connection

    if(this.host && !this.connection){
      throw new Error('existing connection expected')
    }

    if(!this.host && (!this.uri && !this.connection)){
      throw new Error('uri or existing connection expected')
    }
  }


  async socketInit(){
    debug('init')
    
    if(!this.host && !this.connection){
      debug('opening client connection to',this.uri)
      this.connection = new WebSocket(this.uri)
    }

    this.socket = new WebsocketShim(this.connection)
  }
}


module.exports = WebsocketComms