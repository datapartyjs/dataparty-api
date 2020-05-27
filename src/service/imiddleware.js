const debug = require('debug')('dataparty.service.IMiddleware')


module.exports = class IMiddleware {

  static get Name(){
    throw new Error('not implemented')
  }

  static get Type(){
    throw new Error('not implemented - pre or post')
  }

  static get Description(){
    throw new Error('not implemented')
  }

  static get ConfigSchema(){
    throw new Error('not implemented')
  }

  static async run(context){
    throw new Error('not implemented')
  }
}