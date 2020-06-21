const debug = require('debug')('dataparty.MiddlewareExecSandbox')
const Sandbox = require('./sandbox')

class MiddlewareExecSandbox extends Sandbox {
  constructor(code, map, func='run'){
    super(`

module.exports = async (ctx, static_ctx)=>{

  class ErrorError extends Error { 
    constructor(msg){
      super()
      this.code = 'ErrorError'
      this.message = 'You did not throw an error object, always throw an Error object! - [' + msg + ']'
    }
  }

  try{
    let Lib = ${code}

    return await Lib.${func}(ctx, static_ctx)
  }
  catch(err){

    if(!err || !err.stack){
      err = new ErrorError(err)
    }

    throw err
  }

}
    `, map)

    this.result = null
    this.payloadLines = code.split('\n').length-1
  }

  async run(ctx, config){

    debug('running')

    this.result = await super.run(ctx, {Config: config})

    return this.result
  }

}

module.exports = MiddlewareExecSandbox