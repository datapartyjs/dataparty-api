const Joi = require('joi')
const Hoek = require('@hapi/hoek')
const {Message, Routines} = require('@dataparty/crypto')
const debug = require('debug')('dataparty.endpoint.create-service')

const IEndpoint = require('../../service/iendpoint')

module.exports = class CreateSrvEndpoint extends IEndpoint {

  static get Name(){
    return 'create-service'
  }


  static get Description(){
    return 'Create venue service'
  }

  static get MiddlewareConfig(){
    return {
      pre: {
        decrypt: true,
        validate: Joi.object().keys({
          settings: Joi.object().keys({
            enabled: Joi.boolean().default(true).required(),
            domain: Joi.string().required(),
            prefix: Joi.string().default('').required(),
            sendFullErrors: Joi.boolean().default(false).required(),
            useNative: Joi.boolean().default(false).required()
          }).required(),
          service: Joi.object().keys({
            package: Joi.object().keys({
              name: Joi.string().required(),
              version: Joi.string().required(),
              githash: Joi.string().required(),
              branch: Joi.string().required()
            }).required(),
            schemas: Joi.object().keys(null),
            documents: Joi.object().keys(null),
            endpoints: Joi.object().keys(null),
            middleware: Joi.object().keys(null),
            middleware_order: Joi.object().keys(null),
            tasks: Joi.object().keys(null),
            topics: Joi.object().keys(null),
            auth: Joi.object().keys(null),
            compileSettings: Joi.object().keys(null)
          }).required(),
          signature: Joi.object().keys({
            timestamp: Joi.number().required(),
            type: Joi.string().required(),
            value: Joi.string().required()
          }).required()
        })
      },
      post: {
        encrypt: true,
        validate: Joi.object().keys(null).description('any output allowed')
      }
    }
  }

  static async run(ctx){

    //verify sender is admin

    ctx.debug('hello')
    debug('echo')
    ctx.debug('ctx.input', ctx.input)

    const compiledSrv = JSON.parse(ctx.input.service)
    const serviceId = compiledSrv.package.name + '-' + compiledSrv.package.version
    debug('addService', serviceId)

    let srvDoc = (await ctx.party.find()
    .type('venue_srv')
    .where('name').equals(compiledSrv.package.name)
    .exec())[0]

    

    if(!srvDoc){
      debug('creating service')
      srvDoc = await ctx.party.createDocument('venue_srv', {
        name: compiledSrv.package.name,
        'created': (new Date()).toISOString(),
        package: compiledSrv.package,
        schemas: compiledSrv.schemas,
        endpoints: compiledSrv.endpoints,
        midddleware: compiledSrv.middleware,
        middleware_order: compiledSrv.middleware_order
      })

      debug('service created')
    }
    else{


      try{

        debug('updating service')
        debug(srvDoc.data)
        await srvDoc.mergeData({
          package: compiledSrv.package,
          schemas: compiledSrv.schemas,
          endpoints: compiledSrv.endpoints,
          midddleware: compiledSrv.middleware,
          middleware_order: compiledSrv.middleware_order
        })
  
        //debug(srvDoc.data)
  
        debug('saving doc')


        await srvDoc.save()
      }
      catch(err){
        console.log(err)
      }
      debug('updated service')
    }

    return {srv:srvDoc.data}
  }
}