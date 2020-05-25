const debug = require('debug')('dataparty.service.IEndpoint')


module.exports = class IEndpoint {

  constructor(serviceParty){
    this.serviceParty = serviceParty
  }

  static get Name(){
    throw new Error('not implemented')
  }

  static get Description(){
    throw new Error('not implemented')
  }

  static get MiddlewareConfig(){
    throw new Error('not implemented')
  }

  async start(){ 
    //! In case you need to do some setup
  }

  async run(context){
    throw new Error('not implemented')
  }
}