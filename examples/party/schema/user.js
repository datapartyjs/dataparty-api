'use strict'

const ISchema = require('../../../src/index').Bouncer.ISchema

const Utils = ISchema.Utils

class User extends ISchema {

  static get Type () { return 'user' }

  static get Schema(){
    return {
      name: { type: String, maxlength: 50, minlength: 3, unique: true },
      photo: { type: String, maxlength: 500, description: 'user photo url' },
      created: Utils.created,
      enabled: Boolean,
      profile: Object,
      tutorial: {
        done: Boolean
      }
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


module.exports = User
