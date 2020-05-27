//const debug = require('debug')('dataparty.MiddlewareExecSandbox')
const Sandbox = require('./sandbox')

class MiddlewareExecSandbox extends Sandbox {
  constructor(code, func='run'){
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
    `)

    this.result = null
  }

  async run({ctx, static_ctx, party}){


    this.result = await super.run(ctx, static_ctx)

    return this.result
  }

}

module.exports = MiddlewareExecSandbox