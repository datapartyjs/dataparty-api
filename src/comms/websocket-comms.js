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
  constructor({uri, connection, timeout=10000, remoteIdentity, host, party, ...options}){
    super({remoteIdentity, host, party, ...options})

    this.uri = uri
    this.connection = connection
    this.timeout = timeout

    debug('starting host=',host, ' uuid=', this.uuid, ' uri=', this.uri)

    if(this.host && !this.connection){
      throw new Error('existing connection expected')
    }

    if(!this.host && (!this.uri && !this.connection)){
      throw new Error('uri or existing connection expected')
    }
  }


  async socketInit(){
    debug('init')
    let isNewConnection = false

    if(!this.host && !this.connection){
      debug('opening client connection to',this.uri)
      this.connection = new WebSocket(this.uri)

      isNewConnection = true
    }

    this.socket = new WebsocketShim(this.connection)

    if(isNewConnection){

      //await new Promise((resolve,reject)=>{
        const timer = setTimeout(() => {
            debug('websocket timeout')
            this.connection.close()
            this.emit('timeout')
            //reject(new Error("WebSocket connection timeout"));
        }, this.timeout);

        this.socket.once('connect', () => {
          debug('websocket opened')
          clearTimeout(timer);
          //resolve();
        })

        this.socket.once('error',(error) => {
          debug('websocket error', error)
          clearTimeout(timer)
          this.emit('error', error)
          //this.connection.close()
          //reject(error);
        })
      //})
    }

    
  }
}


module.exports = WebsocketComms