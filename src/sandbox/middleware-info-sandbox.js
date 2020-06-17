const debug = require('debug')('dataparty.MiddlewareInfoSandbox')
const Sandbox = require('./sandbox')

class MiddlewareInfoSandbox extends Sandbox {
  constructor(code){
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
      Type: Lib.Type,
      Description: Lib.Description,
      ConfigSchema: Lib.ConfigSchema
    }
  }
  catch(err){

    if(!err || !err.stack){
      err = new ErrorError(err)
    }

    throw err
  }

}
    `)

    this.info = null
  }

  async run(){

    debug('running', this.code)
    this.info = await super.run()

    return this.info
  }

}

module.exports = MiddlewareInfoSandbox