const EventEmitter = require('last-eventemitter')

const IParty = require('../iparty')
const Qb = require('../qb')

module.exports = class IBouncer extends IParty {

  constructor({db, acl}){}

  async adminAsk({ actor, bundle, context }){}

  async userAsk({ actor, bundle, context }){}

  emitChange()
  
}
