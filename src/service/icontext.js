const debug = require('debug')('dataparty.service.IContext')

module.exports = class IContext {
  constructor({
    req, res,
    service, endpoint 
  }){

    this.serviceParty = serviceParty
    this.endpoint = endpoint


  }
}