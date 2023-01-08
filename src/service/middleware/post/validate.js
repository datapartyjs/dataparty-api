const Joi = require('@hapi/joi')
const Hoek = require('@hapi/hoek')
const debug = require('debug')('dataparty.middleware.post.validate')

const IMiddleware = require('../../imiddleware')

const MiddlewareValidationError = require('../../../errors/middleware-validation-error')

module.exports = class Validate extends IMiddleware {

  static get Name(){
    return 'validate'
  }

  static get Type(){
    return 'post'
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


    const validatedOutput = await Config.validate(context.output)


    context.setOutput(validatedOutput.value)
    
    if(validatedOutput.error){
      context.setOutputError(validatedOutput.error)

      throw new MiddlewareValidationError(validatedOutput.error, validatedOutput)
    }
  }
}