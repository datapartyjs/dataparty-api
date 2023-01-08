const Joi = require('@hapi/joi')
const Hoek = require('@hapi/hoek')
const debug = require('debug')('dataparty.middleware.pre.validate')

const IMiddleware = require('../../imiddleware')

const MiddlewareValidationError = require('../../../errors/middleware-validation-error')

module.exports = class Validate extends IMiddleware {

  static get Name(){
    return 'validate'
  }

  static get Type(){
    return 'pre'
  }

  static get Description(){
    return 'Validate inbound data'
  }

  static get ConfigSchema(){
    return Joi.object()
  }

  static async start(party){
    
  }

  static async run(context, {Config}){

    if (!Config){ return }


    const validatedInput = await Config.validate(context.input)


    context.setInput(validatedInput.value)
    
    if(validatedInput.error){
      context.setInputError(validatedInput.error)

      throw new MiddlewareValidationError(validatedInput.error, validatedInput.error)
    }
  }
}