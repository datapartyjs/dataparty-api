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
        decrypt: false,
        validate: Joi.object().keys(null)
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