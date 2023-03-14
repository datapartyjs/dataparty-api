const Joi = require('@hapi/joi')
const debug = require('debug')('dataparty.endpoint.echo')

const IEndpoint = require('../iendpoint')

module.exports = class EchoEndpoint extends IEndpoint {

  static get Name(){
    return 'echo'
  }


  static get Description(){
    return 'Echo input'
  }

  static get MiddlewareConfig(){
    return {
      pre: {
        decrypt: false,
        validate: Joi.object().keys(null).description('any input allowed'),
      },
      post: {
        encrypt: false,
        validate: Joi.object().keys(null).description('any output allowed')
      }
    }
  }

  static async run(ctx, {Package}){

    ctx.debug('hello')
    debug('echo')
    ctx.debug('ctx.input', ctx.input)

    return ctx.input
  }
}