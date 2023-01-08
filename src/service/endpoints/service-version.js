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
      pre: {
        decrypt: false,
        validate: Joi.object().keys({}).description('no input allowed'),
      },
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

  static async run(ctx, {Package}){

    return {
      ...Package
    }
  }
}