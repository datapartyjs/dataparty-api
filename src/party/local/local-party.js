'use strict'

const debug = require('debug')('dataparty.dataparty')

const IParty = require('../iparty')
const LokiDb = require('./loki-db')

const Qb = require('../cloud/qb')
const Query = require('../cloud/query')


/**
 * @class 
 * @alias module:dataparty.LocalParty
 * @interface
 */
class LocalParty extends IParty {

  constructor ({path, dbAdapter, ...options}) {
    super(options)

    this.db = new LokiDb({
      path, factory: this.factory
    })

    this.qb = new Qb({
      call: this.db.handleCall.bind(this.db),
      cache: this.cache
    })
  }

  async start(){
    await super.start()
    await this.db.start()
  }


 /**
   * @method
   */
  find () {
    return new Query(this.qb, this.factory)
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