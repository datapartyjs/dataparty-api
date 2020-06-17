const IRunner = require('./irunner')

const MiddlewareInfoSandbox = require('../sandbox/middleware-info-sandbox')
const MiddlewareExecSandbox = require('../sandbox/middleware-exec-sandbox')

class MiddlewareRunner extends IRunner {
  constructor(code){
    super({
      info: new MiddlewareInfoSandbox(code),
      exec: new MiddlewareExecSandbox(code),
      start: new MiddlewareExecSandbox(code,'start')
    })
  }
}

module.exports = MiddlewareRunner