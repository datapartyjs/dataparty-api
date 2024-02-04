'use strict'

const debug = require('debug')('venue.venue_srv')


const ISchema = require('../../index').Bouncer.ISchema

const Utils = ISchema.Utils


class VenueSrv extends ISchema {

  static get Type () { return 'venue_srv' }

  static get Schema(){
    return {
      //project: Utils.actor(['venue_project']),
      name: {type: String, required: true},
      created: Utils.created,
      //owner: Utils.actor(['user']),
      package: {
        name: String,
        version: String,
        githash: String,
        branch: String
      },
      schemas: {
        IndexSettings: {},
        JSONSchema: {},
        Permissions: {}
      },
      documents: {},
      endpoints: {},
      middleware: {
        pre: {},
        post: {}
      },
      middleware_order: {
        pre: [String],
        post: [String]
      },
      tasks: {},
      compileSettings: {
        cache: Boolean,
        externals: [String],
        minify: Boolean,
        sourceMap: Boolean,
        sourceMapRegister: Boolean,
        watch: Boolean,
        v8cache: Boolean,
        quite: Boolean,
        debugLog: Boolean,
        esm: Boolean,
        moduleType: Boolean,
        libraryName: Boolean
      }
    }
  }

  static setupSchema(schema){
    schema.index({ name: 1 }, {unique: true})
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


module.exports = VenueSrv