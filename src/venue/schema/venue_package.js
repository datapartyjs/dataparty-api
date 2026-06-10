'use strict'

const debug = require('debug')('venue.venue_pkg')

const ISchema = require('../../bouncer/ischema')

//const Utils = ISchema.Utils


class VenuePkg extends ISchema {

  static get Type () { return 'venue_pkg' }

  static get Schema(){
    return {
      owner: {type: String, required: true, index: true},  //public_key.key.hash
      created: {type: Number, required: true},
      changed: {type: Number},
      venue: {type: String},
      workspace: {type: String, required: true},
      hash: {type: String, required: true, index: true},
      settings: {
        //enabled: {type: Boolean, required: true},
        staticPrefix: String,
        sendFullErrors: {type: Boolean, required: true},
        useNative: {type: Boolean, required: true},
        defaultConfig: {type: Object}
      },
      package: {
        name: {type: String, required: true, index: true},
        version: {type: String, required: true, index: true},
        githash: {type: String, required: true},
        branch: {type: String, required: true},
      },
      compressedBuild: {type: String, required: true} //! brotli compressed
    }
  }

  static setupSchema(schema){
    //schema.index({ 'package.name': 1 }, {unique: true})
    return schema
  }

  static permissions (context) {
    return {
      read: false,
      new: false,
      change: false
    }
  }
}


module.exports = VenuePkg