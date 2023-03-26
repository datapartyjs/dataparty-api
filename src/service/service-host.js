const CORS = require('cors')
const {URL} = require('url')
const http = require('http')
const https = require('https')
const morgan = require('morgan')
const express = require('express')
const bodyParser = require('body-parser')
const expressListRoutes = require('express-list-routes')
const debug = require('debug')('dataparty.service.host')

const ServiceHostWebsocket = require('./service-host-websocket')

const Pify = async (p)=>{
  return await p
}

/**
 * @class
 */
class ServiceHost {
  constructor({
    cors = {},
    trust_proxy = false,
    listenUri = 'http://0.0.0.0:4001',
    i2pEnabled = false,
    i2pSamHost = '127.0.0.1',
    i2pSamPort = 4444,
    i2pKey = null,
    wsEnabled = true,
    wsPort = null,
    wsUpgradePath = '/ws',
    runner
  }={}){
    this.apiApp = express()
    this.runner = runner
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
          host: this.apiServerUri.host,
          port: this.apiServerUri.port
        }
      }
    }

    this.started = false
  }

  async start(){

    if(this.started){return}

    this.started = true

    debug('starting server', this.apiServerUri.toString())

    if(this.apiServer==null){
      debug('adding default endpoints')
      //Setup router
      this.apiApp.use(this.runner.onRequest.bind(this.runner))

      if(debug.enabled){ expressListRoutes('API:', this.router ) }
    }

    let listenPort = this.apiServerUri.port
    let listenHost = this.apiServerUri.hostname
    
    if(this.apiServerUri.protocol == 'http:'){

      //! Handle http
      this.apiServer = http.createServer(this.apiApp)

    } else if(this.apiServerUri.protocol == 'https:'){

      //! Handle https
      this.apiServer = https.createServer(this.apiApp)

    } else if(this.apiServerUri.protocol == 'file:'){

      //! Handle unix socket
      listenHost = null
      listenPort = this.apiServerUri.pathname
      this.apiServer = http.createServer(this.apiApp)

    }


    await new Promise((resolve,reject)=>{
      this.apiServer.listen(listenPort, listenHost, resolve)
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
      debug('starting i2p forward')
      const SAM = require('@diva.exchange/i2p-sam')

      this.i2p = await SAM.createForward(this.i2pSettings)
      this.i2pUri = this.i2p.getPublicKeys()
      this.i2pSettings.privateKey = null  // clear no longer needed

      this.i2p.on('error', this.reportI2pError.bind(this))

      debug('i2p started')
      debug('\t','address', this.i2pUri)
    }
  }

  async stop(){
    debug('stopping server')

    if(!this.apiServer || !this.apiServer.listening){
      return
    }

    clearTimeout(this.errorHandlerTimer)
    this.errorHandlerTimer = null

    await (Pify(this.apiServer.close)())

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
