const net = require('net')
const http = require('http')
const https = require('https')

const Pify = require('pify')
const debug = require('debug')('roshub.server')
const Hoek = require('hoek')
const morgan = require('morgan')
const express = require('express')
const CORS = require('cors')
const expressListRoutes = require('express-list-routes')
const bodyParser = require('body-parser')
const {URL} = require('url');


class ServiceHost {
  constructor({
    listenUri = 'http://0.0.0.0:4001',
    cors = null,
    trust_proxy = false
  }){
    this.apiApp = express()
    this.router = express.Router()


    if(cors){
      this.apiApp.use(CORS())
      this.apiApp.options('*', CORS(cors))
    }
    

    if(debug.enabled){ this.apiApp.use(morgan('combined')) }

    this.apiApp.use(bodyParser.urlencoded({ extended: true }))
    this.apiApp.use(bodyParser.json())

    this.apiApp.set('trust proxy', trust_proxy)

    this.apiServer = null
    this.errorHandlerTimer = null

    this.apiServerUri = new URL(listenUri)
  }


  async start(){

    debug('starting server')

    if(this.apiServer==null){
      debug('adding default endpoints')
      //Setup router
      //this.apiApp.use(this.router);

      if(debug.enabled){ expressListRoutes('API:', this.router ) }
    }

    let listenPort = this.apiServerUri.port
    let listenHost = this.apiServerUri.host
    
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

    await (Pify(this.apiServer.listen)(listenPort, listenHost))

    clearTimeout(this.errorHandlerTimer)
    this.errorHandlerTimer = null

    this.apiServer.on('error', this.handleServerError.bind(this))

    debug('server listening')
    debug('address', this.apiServer.address())
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
