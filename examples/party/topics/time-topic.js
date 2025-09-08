
const debug = require('debug')('dataparty.topis.time-topic')

const ITopic = require('../../../src/service/itopic')

class TimeTopic extends ITopic {

  constructor({context}){
    super({context})
  }

  static get Name(){
    return '/time/:session'
  }

  static get Description(){
    return 'time topic'
  }

  async canAdvertise(identity, args){
    
    return true
  }

  async canPublish(identity, args){
    
    return true
  }

  async canSubscribe(identity, args){
    return true
  }

}


module.exports = TimeTopic
