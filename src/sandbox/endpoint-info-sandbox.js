const debug = require('debug')('dataparty.EndpointInfoSandbox')
const Sandbox = require('./sandbox')

class EndpointInfoSandbox extends Sandbox {
  constructor(code, map){
    super(`

var self={};

function userCode(){
  ${code}
}

module.exports = async ()=>{

  class ErrorError extends Error { 
    constructor(msg){
      super()
      this.code = 'ErrorError'
      this.message = 'You did not throw an error object, always throw an Error object! - [' + msg + ']'
    }
  }

  try{

    userCode()

    return {
      Name: self.Lib.Name,
      Description: self.Lib.Description,
      MiddlewareConfig: self.Lib.MiddlewareConfig
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