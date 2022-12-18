const {URL} = require('url')
const debug = require('debug')('dataparty.service.host-websocket')

const ws = require('ws')
const WebSocketServer = ws.WebSocketServer

const WATCHDOG_INTERVAL = 30000

const Comms = require('../comms')
const PeerParty = require('../party/peer/peer-party')

class ServiceHostWebsocket{

  constructor({trust_proxy, port, path, runner, wsSettings}){
    this.port = port
    this.path = path || '/ws'
    this.runner = runner
    this.trust_proxy = trust_proxy
    this.wsSettings = wsSettings || {}

    this.ws = null
  }

  start(server){

    debug('start')

    let settings = {}

    if(!server){
      settings = { port: this.port, ...this.wsSettings }
      
    } else {
      settings = { noServer: true, ...this.wsSettings }
    }

    debug('\t','settings', settings)

    this.ws = new WebSocketServer(settings)

    this.ws.on('connection', this.handleConnection.bind(this))

    server.on('upgrade', this.handleUpgrade.bind(this))

    this.watchdog = setInterval(this.checkClients.bind(this), WATCHDOG_INTERVAL) 
  }

  handleUpgrade(request, socket, head){

    debug('handleUpgrade', request.headers.host, request.url)

    if(request.url == this.path){
      this.doUpgrade(request, socket, head)
    } else {
      socket.destroy()
    }
  }

  doUpgrade(request, socket, head){
    debug('doUpgrade')
    this.ws.handleUpgrade(request, socket, head, (conn)=>{
      this.ws.emit('connection', conn, request)
    })
  }

  getConnectionIp(req){
    let ip = null
    if(this.trust_proxy){

      if(!req.headers['x-forwarded-for']){
        debug('getConnectionIp - WARN - connection without x-forwarded-for', req.socket.remoteAddress)
      }
      else{
        debug('getConnectionIp - xfwd', req.headers['x-forwarded-for'])
        ip = req.headers['x-forwarded-for'].split(',')[0].trim();
      }
    }

    if(!ip){
      return req.socket.remoteAddress
    }

    return ip

  }

  async handleConnection(conn, req){
   conn.ip = this.getConnectionIp(req)
    
    debug('handleConnection - ', conn.ip, '\t>\t' , req.headers.host, req.url)

    conn.isAlive = true
    conn.on('pong', ()=>{
      conn.isAlive = true
    })

    conn.on('close',()=>{
      debug('connection closed', conn.ip)
    })

    debug('creating peer party')

    let peer = new PeerParty({
      hostParty: this.runner.party,
      model: this.runner.party.factory.model,
      config: this.runner.party.config,
      comms: new Comms.WebsocketComms({
        host: true,
        connection: conn,
        discoverRemoteIdentity: true
      })
    })

    await peer.start()
    debug('peer created')

  }

  checkClients(){
    debug('checkClients', this.ws.clients.size)
    this.ws.clients.forEach( (conn)=>{
      if (conn.isAlive === false){
        debug('\t','terminating client', conn.ip)
        return conn.terminate()
      }
  
      conn.isAlive = false
      conn.ping()
    });
  }
}

module.exports = ServiceHostWebsocket