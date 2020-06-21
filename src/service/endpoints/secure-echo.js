const Joi = require('@hapi/joi')
const Hoek = require('@hapi/hoek')
const {Message, Routines} = require('@dataparty/crypto')
const debug = require('debug')('dataparty.endpoint.secure-echo')

const IEndpoint = require('../iendpoint')

module.exports = class SecureEchoEndpoint extends IEndpoint {

  static get Name(){
    return 'secure-echo'
  }


  static get Description(){
    return 'Secure echo input'
  }

  static get MiddlewareConfig(){
    return {
      pre: {
        decrypt: true,
        validate: Joi.object().keys(null).description('any input allowed'),
      },
      post: {
        encrypt: false,
        validate: Joi.object().keys(null).description('any output allowed')
      }
    }
  }

  static async run(ctx){

    ctx.debug('hello')
    debug('echo')
    ctx.debug('ctx.input', ctx.input)

    return ctx.input
  }
}