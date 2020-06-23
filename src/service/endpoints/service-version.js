const Joi = require('@hapi/joi')
const Hoek = require('@hapi/hoek')
const {Message, Routines} = require('@dataparty/crypto')
const debug = require('debug')('dataparty.endpoint.version')

const IEndpoint = require('../iendpoint')

module.exports = class ServiceVersion extends IEndpoint {

  static get Name(){
    return 'version'
  }


  static get Description(){
    return 'Get service version'
  }

  static get MiddlewareConfig(){
    return {
      post:{
        validate: Joi.object().keys({
          name: Joi.string(),
          branch: Joi.string(),
          version: Joi.string(),
          githash: Joi.string()
        })
      }
    }
  }

  static async run(ctx, static_ctx){

    return {
      ...Package
    }
  }
}