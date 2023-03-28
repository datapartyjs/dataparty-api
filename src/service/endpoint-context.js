const Debug = require('debug')

const DeltaTime = require('../utils/delta-time')

class EndpointContext {

  /**
   * @class module:Service.EndpointContext
   * @link module:Service
   * @param {module:Party.IParty} options.party           The party handling the request
   * @param {module:Service.IEndpoint} options.endpoint        The endpoint being executed
   * @param {Express.Request} options.req             Express js request object
   * @param {Express.Response} options.res             Express js response object
   * @param {*} options.input           Raw input from client
   * @param {Debug} options.debug           Debug constructor (defaults to npm:Debug)
   * @param {boolean} options.sendFullErrors  Enables sending full stack traces to client (defaults to false)
   */
  constructor({party, endpoint, req, res, input, debug=Debug, sendFullErrors=false}){

    /**
     * @member module:Service.EndpointContext.debug
     */
    this.party = party

    /**
     * @member module:Service.EndpointContext.endpoint
     */
    this.endpoint = endpoint

    /**
     * @member module:Service.EndpointContext.MiddlewareConfig
     */
    this.MiddlewareConfig = endpoint.info.MiddlewareConfig

    /**
     * @member module:Service.EndpointContext.req
     */
    this.req = req

    /**
     * @member module:Service.EndpointContext.res
     */
    this.res = res

    /**
     * @member module:Service.EndpointContext.actor
     */
    this.actor = null
  
    /**
     * @member module:Service.EndpointContext.stats
     */
    this.stats = {
      start: Date.now(),
      bytes_in: !req ? null : JSON.stringify(req.body).length
    }
    this.oauth_cloud = null

    /**
     * @member module:Service.EndpointContext.session
     */
    this.session = null
    
    /**
     * Effective root of trust
     * @member module:Service.EndpointContext.identity
     * @type {dataparty_crypto.Identity}
     */
    this.identity = null
    
    /**
     * @member module:Service.EndpointContext.input
     * @type {Object}
     */
    this.input = input
    this.input_session_id = null
    this.inputError = null

    /**
     * @member module:Service.EndpointContext.output
     */
    this.output = null
    this.outputError = null

    /**
     * Key used to encrypt content. This may be an ephermal key or a long lived key.
     * @type {dataparty_crypto.Identity}
     * @member module:Service.EndpointContext.senderKey
     */
    this.senderKey = null

    this.sendFullErrors = sendFullErrors
    
    this._debug = debug('dataparty.context.undefined')
    this._debugContent = []
    this.dt = new DeltaTime().start()
  }

  setReq(req){ this.req = req }
  setRes(res){ this.res = res }
  setCloud(cloud){ this.cloud = cloud }

  setSenderKey(key){
    this.senderKey = key
  }

  setSession(session){
    this.session = session
    this.debug('session' + session)
  }

  setOauthCloud(oauth_cloud){
    this.oauth_cloud = oauth_cloud
    this.debug('oauth cloud', oauth_cloud.id)
  }

  setInput(input){
    this.input = input
    this.debug('input set')
  }

  setOutput(output){
    this.output = output
    this.debug('output set')
  }

  setInputError(error){
    this.inputError = error
    this.debug('input error', error)
  }

  setOutputError(error){
    this.outputError = error
    this.debug('output error', error)
  }

  setIdentity(identity){ this.identity = identity }
  setActor(actor){ this.actor = actor }
  setInputSession(input_session_id){ this.input_session_id = input_session_id }

  /**
   * @method module:Service.EndpointContext.setSendFullErrors
   * @param {*} value 
   */
  setSendFullErrors(value){
    this.sendFullErrors = value
  }

  /*async applyMiddleware(){
    
  }*/

  /**
   * @method module:Service.EndpointContext.debug
   * @param {*} msg 
   * @param  {...any} args 
   */
  debug(msg, ...args){
    let line = ((new Error().stack).split('at ')[3]).trim()

    const openParen = line.indexOf('(') + 1
    const closeParen = line.indexOf(')')

    const filePath = line.substring(openParen, closeParen).replace(__dirname, '')
    line = filePath

    const newMsg = line + ' ' + msg

    const logObj = {
      file: filePath,
      time: Date.now(),
      msg: msg + ' ' + args.map(v=>{return JSON.stringify(v)}).join(' ')
    }

    this._debugContent.push(logObj)

    this._debug(newMsg, ...args)
  }
}

module.exports = EndpointContext