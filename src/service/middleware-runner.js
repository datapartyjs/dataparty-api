const ISandboxRunner = require('./isandbox-runner')

const MiddlewareInfoSandbox = require('../sandbox/middleware-info-sandbox')
const MiddlewareExecSandbox = require('../sandbox/middleware-exec-sandbox')

class MiddlewareRunner extends ISandboxRunner {
  constructor(code, map){
    super({
      info: new MiddlewareInfoSandbox(code, map),
      exec: new MiddlewareExecSandbox(code, map),
      start: new MiddlewareExecSandbox(code, map, 'start')
    })
  }
}

module.exports = MiddlewareRunner