const Debug = require('debug')

class EndpointContext {
  constructor({party, endpoint, req, res, input, debug=Debug, sendFullErrors=false}){
    this.party = party
    this.endpoint = endpoint
    this.MiddlewareConfig = endpoint.info.MiddlewareConfig

    this.req = req
    this.res = res
    this.actor = null
    this.stats = {
      start: Date.now(),
      bytes_in: !req ? null : JSON.stringify(req.body).length
    }
    this.oauth_cloud = null
    this.session = null
    this.identity = null
    this.input = input
    this.input_session_id = null
    this.inputError = null

    this.output = null
    this.outputError = null

    this.senderKey = null

    this.sendFullErrors = sendFullErrors
    
    this._debug = debug('dataparty.context.undefined')
    this._debugContent = []
  }

  setReq(req){ this.req = req }
  setRes(res){ this.res = res }
  setCloud(cloud){ this.cloud = cloud }

  setSenderKey(key){
    this.senderKey = key
  }

  setSession(session){
    this.session = session
    this.debug('session.id' + session.id)
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

  setSendFullErrors(value){
    this.sendFullErrors = value
  }

  /*async applyMiddleware(){
    
  }*/

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