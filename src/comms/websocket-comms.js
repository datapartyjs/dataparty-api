const debug = require('debug')('dataparty.comms.websocket')

const isBrowser = typeof window !== 'undefined' &&
                  typeof document !== 'undefined';   

const WebSocket = isBrowser ? global.WebSocket : require('ws')

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
  constructor({uri, connection, timeout=20000, remoteIdentity, host, party, allowSelfSigned=false, ...options}){
    super({remoteIdentity, host, party, ...options})

    this.uri = uri
    this.connection = connection
    this.timeout = timeout
    this.timer = null
    this.allowSelfSigned = allowSelfSigned

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
      this.connection = new WebSocket(this.uri, {
        rejectUnauthorized: !this.allowSelfSigned
      })

      isNewConnection = true
    }

    this.socket = new WebsocketShim(this.connection)

    if(isNewConnection){

      //await new Promise((resolve,reject)=>{
        this.timer = setTimeout(() => {
            debug('websocket timeout')
            this.connection.close()
            this.emit('timeout')
            //reject(new Error("WebSocket connection timeout"));
        }, this.timeout);

        this.socket.once('connect', () => {
          debug('websocket opened')
          clearTimeout(this.timer);
          //resolve();
        })

        this.socket.once('error',(error) => {
          debug('websocket error', error)
          clearTimeout(this.timer)
          this.emit('error', error)
          //this.connection.close()
          //reject(error);
        })
      //})
    }

    
  }
}


module.exports = WebsocketComms