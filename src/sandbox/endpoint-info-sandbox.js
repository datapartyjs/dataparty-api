const debug = require('debug')('dataparty.EndpointInfoSandbox')
const Sandbox = require('./sandbox')

class EndpointInfoSandbox extends Sandbox {
  constructor(code, map){
    super(`  

module.exports = async ()=>{

  class ErrorError extends Error { 
    constructor(msg){
      super()
      this.code = 'ErrorError'
      this.message = 'You did not throw an error object, always throw an Error object! - [' + msg + ']'
    }
  }

  try{
    let Lib = ${code}

    return {
      Name: Lib.Name,
      Description: Lib.Description,
      MiddlewareConfig: Lib.MiddlewareConfig
    }
  }
  catch(err){

    if(!err || !err.stack){
      err = new ErrorError(err)
    }

    throw err
  }

}
    `, map)

    this.info = null
    this.payloadLines = code.split('\n').length-1
  }

  async run(){

    debug('running')

    this.info = await super.run()

    return this.info
  }

}

module.exports = EndpointInfoSandbox