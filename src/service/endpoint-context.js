const Debug = require('debug')

class EndpointContext {
  constructor({party, endpoint, req, res}){
    this.party = party
    this.endpoint = endpoint
    this.MiddlewareConfig = endpoint.info.MiddlewareConfig

    this.req = req
    this.res = res
    this.actor = actor
    this.stats = {
      start: Date.now(),
      bytes_in: !req ? null : JSON.stringify(req.body).length
    }
    this.oauth_cloud = oauth_cloud
    this.session = session
    this.identity = identity
    this.input = input
    this.input_session_id = input_session_id
    this._debug = Debug('dataparty.context.undefined')
    this._debugContent = []
  }

  setReq(req){ this.req = req }
  setRes(res){ this.res = res }
  setCloud(cloud){ this.cloud = cloud }

  setSession(session){
    this.session = session
    this._debug = Debug('dataparty.context.' + session.id)
  }

  setOauthCloud(oauth_cloud){
    this.oauth_cloud = oauth_cloud
    this._debug = Debug('oauth cloud', oauth_cloud.id)
  }

  setIdentity(identity){ this.identity = identity }
  setActor(actor){ this.actor = actor }
  setInputSession(input_session_id){ this.input_session_id = input_session_id }

  applyMiddleware

  debug(msg, ...args){
    let line = ((new Error().stack).split('at ')[2]).trim()

    const openParen = line.indexOf('(') + 1
    const closeParen = line.indexOf(')')

    const filePath = line.substring(openParen, closeParen).replace(__dirname, '')
    line = filePath

    const newMsg = line + ' ' + msg

    this._debugContent.push({
      file: filePath,
      time: Date.now(),
      msg: msg + ' ' + args.map(v=>{return JSON.stringify(v)}).join(' ')
    })
    
    this._debug(newMsg, ...args)
  }
}

module.exports = EndpointContext