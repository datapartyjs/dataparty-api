const ISandboxRunner = require('./isandbox-runner')

const EndpointInfoSandbox = require('../sandbox/endpoint-info-sandbox')
const MiddlewareExecSandbox = require('../sandbox/middleware-exec-sandbox')

class EndpointRunner extends ISandboxRunner {
  constructor(code, map){
    super({
      info: new EndpointInfoSandbox(code, map),
      exec: new MiddlewareExecSandbox(code, map),
      start: new MiddlewareExecSandbox(code, map,'start')
    })
  }
}

module.exports = EndpointRunner