const debug = require('debug')('dataparty.service.IEndpoint')


module.exports = class IEndpoint {

  static get Name(){
    throw new Error('not implemented')
  }

  static get Description(){
    throw new Error('not implemented')
  }

  static get MiddlewareConfig(){
    throw new Error('not implemented')
  }

  static async start(party){
    
  }

  static async run(context){
    throw new Error('not implemented')
  }
}