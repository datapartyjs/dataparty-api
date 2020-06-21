const IRunner = require('./irunner')

const EndpointInfoSandbox = require('../sandbox/endpoint-info-sandbox')
const MiddlewareExecSandbox = require('../sandbox/middleware-exec-sandbox')

class EndpointRunner extends IRunner {
  constructor(code, map){
    super({
      info: new EndpointInfoSandbox(code, map),
      exec: new MiddlewareExecSandbox(code, map),
      start: new MiddlewareExecSandbox(code, map,'start')
    })
  }
}

module.exports = EndpointRunner