'use strict'

const ISchema = require('../../../src/index').Bouncer.ISchema

class BasicTypes extends ISchema {

  static get Type () { return 'basic_types' }

  static get Schema(){
    return {
      number: {type: Number, index: true},
      string: {type: String, index: true},
      time: {type: Date, index: true},
      bool: Boolean,
    }
  }

  static setupSchema(schema){
    return schema
  }

  static permissions (context) {
    return {
      read: true,
      new: true,
      change: true
    }
  }
}


module.exports = BasicTypes
