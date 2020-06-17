const IRunner = require('./irunner')

const EndpointInfoSandbox = require('../sandbox/endpoint-info-sandbox')
const MiddlewareExecSandbox = require('../sandbox/middleware-exec-sandbox')

class EndpointRunner extends IRunner {
  constructor(code){
    super({
      info: new EndpointInfoSandbox(code),
      exec: new MiddlewareExecSandbox(code),
      start: new MiddlewareExecSandbox(code,'start')
    })
  }
}

module.exports = EndpointRunner