const net = require('net')
const http = require('http')
const https = require('https')

const debug = require('debug')('roshub.server')
const Hoek = require('hoek')
const morgan = require('morgan')
const express = require('express')
const CORS = require('cors')
const expressListRoutes = require('express-list-routes')
const bodyParser = require('body-parser')
const {URL} = require('url');


const Cloud = require('./cloud')
const ClientApi = require('./api')
const OAuth = require('./oauth')

class ServiceHost {
  constructor({
    party, listenUri = 'http://0.0.0.0:4001',
    cors = null,
    trust_proxy = false
  }){
    this.party = party  //! Host party
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

    if(this.apiServer==null){
      debug('adding default endpoints')
      //Setup router
      //this.apiApp.use(this.router);

      if(debug.enabled){ expressListRoutes('API:', this.router ) }
    }

    if(this.apiServerUri.protocol == 'file:'){
      //! Handle unix socket
      this.apiServer = http.createServer(this.apiApp)
      this.apiServer.listen( this.apiServerUri.pathname )

    } else {
      //! Handle http / https
      if(this.apiServerUri.protocol == 'http:'){
        this.apiServer = http.createServer(this.apiApp)
      } else if(this.apiServerUri.protocol == 'https:'){
        this.apiServer = https.createServer(this.apiApp)
      } 
  
      this.apiServer.listen( this.apiServerUri.port, this.apiServerUri.host )
    }
    

    

  }

  async stop(){
  }

  handleServerErrorRetry(error){
    debug('Error - ', JSON.stringify(error))
    this.errorHandlerTimer = setTimeout( ()=>{

      if(this.apiServer){
        this.stop().then(this.start.bind(this))
      }

    }, 1500)
  }
}


module.exports = ServiceHost
