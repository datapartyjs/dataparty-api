const EventEmitter = require('last-eventemitter')


module.exports = class IBouncer extends EventEmitter {

  constructor({db}){}

  async adminAsk({ actor, bundle, context }){}

  async userAsk({ actor, bundle, context }){}
  
}
