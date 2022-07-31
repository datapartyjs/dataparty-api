const EventEmitter = require('last-eventemitter')

const IParty = require('../iparty')
const Qb = require('../qb')

module.exports = class IBouncer extends IParty {

  constructor({db, acl}){}

  async adminAsk({ actor, bundle, context }){
    let crufler = new AdminCrufler({db: this.db, context: this.context})
  }

  async aclAsk({ actor, bundle, context }){}

  //emitChange()
  
}
