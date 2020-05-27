const {VM, VMScript} = require('vm2')
const debug = require('debug')('dataparty.server-runner')


class CodeAccessor {
  constructor(code){
    this.script = new VMScript(code)
  }
}

class ServiceRunner {
  constructor({service}){
    //
  }

  async buildEndpointVM(name){ /**/ }

  async buildMiddlewareVM(name){ /**/ }

  async onRequest(req, res){
    debug('onRequest')
  }
}

