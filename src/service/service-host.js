const CORS = require('cors')
const {URL} = require('url')
const http = require('http')
const https = require('https')
const morgan = require('morgan')
const express = require('express')
const bodyParser = require('body-parser')
const expressListRoutes = require('express-list-routes')
const debug = require('debug')('dataparty.service.host')

const reach = require('../utils/reach')

const ServiceHostWebsocket = require('./service-host-websocket')

const Pify = (p)=>{
  return new Promise((resolve,reject)=>{
    p(resolve)
  })
}

class ServiceHost {

  /**
   * @class module:Service.ServiceHost
   * @link module:Service
   * @param {Object}  options.cors            Cors to be passed to express via the `cors` package
   * @param {boolean} options.trust_proxy     When true, the server will parse forwarding headers. This should be set when running behind a load-balancer for accurate error messages and logging
   * @param {string}  options.listenUri       The uri of the host interface to tell express to listen on. Defaults to `http://0.0.0.0:4001
   * @param {boolean} options.i2pEnabled      When true, this server will be available over i2p
   * @param {string}  options.i2pSamHost      The hostname of the i2p SAM control API. Defaults to `127.0.0.1`
   * @param {Integer} options.i2pSamPort      The port of the i2p SAM control API. Defaults to `7656`
   * @param {string}  options.i2pForwardHost  Override i2p forward host. This defaults to `localhost` and typically doesn't need to be changed
   * @param {Integer} options.i2pForwardPort  Override i2p forward post. This defaults to the port supplied in `options.listenUri`.
   * @param {string}  options.i2pKey          When set this i2p key will be used to host the service. If not set a new i2p key will be generated. Defaults to `null`
   * @param {boolean} options.wsEnabled       When true the server will host a dataparty websocket service. Defaults to `true`
   * @param {Integer} options.wsPort          Port for the websocket service to listen on. Defaults to `null`, using the same port as the http server.
   * @param {string}  options.wsUpgradePath   The path within the http server to host an upgradeable websocket. Defaults to `/ws`
   * @param {module:Service.ServiceRunner}  options.runner  A pre-configured runner
   */

  constructor({
    cors = {},
    trust_proxy = false,
    listenUri = 'http://0.0.0.0:4000',
    i2pEnabled = false,
    i2pSamHost = '127.0.0.1',
    i2pSamPort = 7656,
    i2pKey = null,
    i2pForwardHost = 'localhost',
    i2pForwardPort = null,
    wsEnabled = true,
    wsPort = null,
    wsUpgradePath = '/ws',
    runner
  }={}){

    /**
   * Express app
   * @member module:Service.ServiceHost.apiApp
   * @type {Express}
   */
    this.apiApp = express()

    /**
     * Dataparty service runner
     * @member module:Service.ServiceHost.runner
     * @type {module:Service.ServiceRunner}
     */
    this.runner = runner

    /**
     * The router
     * @member module:Service.ServiceHost.router
     * @type {Router}
     */
    this.router = express.Router()

    if(cors){
      this.apiApp.use(CORS())
      this.apiApp.options('*', CORS(cors))
    }
    

    if(debug.enabled){ this.apiApp.use(morgan('combined')) }

    this.apiApp.use(bodyParser.urlencoded({ extended: true }))
    this.apiApp.use(bodyParser.json())
    this.apiApp.use(bodyParser.raw())

    this.apiApp.set('trust proxy', trust_proxy)

    this.apiServer = null
    this.errorHandlerTimer = null

    this.apiServerUri = new URL(listenUri)

    if(wsEnabled){
      this.wsServer = new ServiceHostWebsocket({
        trust_proxy,
        port: wsPort,
        upgradePath: wsUpgradePath,
        runner: this.runner
      })
    }

    if(i2pEnabled){
      this.i2pEnabled = true

      this.i2p = null
      this.i2pSettings = {
        sam: {
          host: i2pSamHost,
          portTCP: i2pSamPort,
          publicKey: reach(i2pKey, 'publicKey'),
          privateKey: reach(i2pKey, 'privateKey')
        },
        forward: {
          host: i2pForwardHost ? i2pForwardHost : this.apiServerUri.hostname,
          port: i2pForwardPort ? i2pForwardPort : parseInt( this.apiServerUri.port )
        }
      }
    }

    this.started = false
  }

  /**
   * Start hosting services
   * @method module:Service.ServiceHost.start
   * @async
   */
  async start(){

    if(this.started){return}

    this.started = true

    debug('starting server', this.apiServerUri.toString())

    if(this.apiServer==null){
      debug('adding default endpoints')
      //Setup router
      this.apiApp.use(this.runner.onRequest.bind(this.runner))

      if(debug.enabled){ expressListRoutes(this.router ) }
    }

    let backlog = 511
    let listenPort = this.apiServerUri.port
    let listenHost = this.apiServerUri.hostname
    
    if(this.apiServerUri.protocol == 'http:'){

      debug('http server')

      //! Handle http
      this.apiServer = http.createServer(this.apiApp)

    } else if(this.apiServerUri.protocol == 'https:'){

      debug('http server')

      //! Handle https
      this.apiServer = https.createServer(this.apiApp)

    } else if(this.apiServerUri.protocol == 'file:'){

      debug('unix socket server')

      //! Handle unix socket
      listenHost = null
      listenPort = this.apiServerUri.pathname
      this.apiServer = http.createServer(this.apiApp)

    }


    await new Promise((resolve,reject)=>{

      debug('listening', this.apiServerUri.toString())

      this.apiServer.listen(listenPort, listenHost==null ? backlog : listenHost, resolve)
    })

    clearTimeout(this.errorHandlerTimer)
    this.errorHandlerTimer = null

    this.apiServer.on('error', this.handleServerError.bind(this))

    debug('server listening')
    debug('\t', 'address', this.apiServer.address())

    if(this.wsServer && this.apiServer){
      debug('starting websocket')
      this.wsServer.start(this.apiServer)
    }

    if(this.i2pEnabled && this.i2p == null){
      debug('starting i2p forward', this.i2pSettings)
      const SAM = require('@diva.exchange/i2p-sam')

      this.i2p = await SAM.createForward(this.i2pSettings)
      this.i2pUri = this.i2p.getB32Address()
      this.i2pSettings.privateKey = null  // clear no longer needed



      this.i2p.on('error', this.reportI2pError.bind(this))


      this.i2p.on('close', ()=>{
        debug('i2p closed')
      })

      this.i2p.on('data', (data)=>{
        debug('i2p data')
        debug(data.toString())
      })

      debug('i2p started')
      debug('\t', 'address', this.i2pUri)
      debug('\t', 'key', this.i2p.getPublicKey())
    }
  }

  /**
   * Stop hosting services
   * @method module:Service.ServiceHost.stop
   * @async
   */
  async stop(){
    
    if(!this.apiServer || !this.apiServer.listening){
      return
    }
    
    debug('stopping server')
    
    clearTimeout(this.errorHandlerTimer)
    this.errorHandlerTimer = null

    await new Promise((resolve,reject)=>{
      this.apiServer.close(resolve)
    })

    debug('stopped server')
  }

  reportI2pError(error){
    debug('WARN - I2P ERROR -', JSON.stringify(error), error.toString())
  }

  handleServerError(error){
    debug('CRITICAL ERROR - ', JSON.stringify(error))
    this.errorHandlerTimer = setTimeout( ()=>{

      debug('restarting server')

      if(this.apiServer){
        this.stop().then(this.start.bind(this))
      }

    }, 1500)
  }
}


module.exports = ServiceHost
