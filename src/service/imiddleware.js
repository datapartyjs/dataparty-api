const debug = require('debug')('dataparty.service.IMiddleware')


module.exports = class IMiddleware {
  constructor({
    serviceParty
  }){
    this.serviceParty = serviceParty
  }

  static get Name(){
    throw new Error('not implemented')
  }

  static get Description(){
    throw new Error('not implemented')
  }

  static get ConfigSchema(){
    throw new Error('not implemented')
  }

  async start(){ 
    //! In case you need to do some setup
  }

  async run(){
    throw new Error('not implemented')
  }
}