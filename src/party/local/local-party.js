'use strict'

const debug = require('debug')('dataparty.dataparty')

const IParty = require('../iparty')



/**
 * @class 
 * @alias module:dataparty.LocalParty
 * @interface
 */
class LocalParty extends IParty {

  constructor ({db, ...options}) {
    super(options)

    this.qb = new Qb({
      call: this.call.bind(this),
      cache: this.cache
    })
  }



 /**
   * @method
   */
  find () {
    return new Query(this.qb, this.model)
  }

  // takes modified json msgs & writes to backend, resolves to new stamps
  // requires type & id
  /**
   * @method
   */
  update (...msgs) {
    return this.qb.modify(msgs, 'update')
  }


 /**
   * @method
   */
  create (type, ...msgs) {
    return this.qb.create(type, msgs)
  }


/**
   * @method
   */
  remove (...msgs) {
    return this.qb.modify(msgs, 'remove')
  }
}

module.exports = LocalParty