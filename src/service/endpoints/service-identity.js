const Joi = require('@hapi/joi')
const Hoek = require('@hapi/hoek')
const {Message, Routines} = require('@dataparty/crypto')
const debug = require('debug')('dataparty.endpoint.identity')

const IEndpoint = require('../iendpoint')

module.exports = class ServiceIdentity extends IEndpoint {

  static get Name(){
    return 'identity'
  }


  static get Description(){
    return 'Get host identity'
  }

  static get MiddlewareConfig(){
    return {
      pre: {
        decrpyt: false,
        validate: Joi.object().keys({}).description('no input allowed'),
      }
    }
  }

  static async run(ctx, static_ctx){

  
    const identity = ctx.party.identity

    return {
      ...identity
    }
  }
}