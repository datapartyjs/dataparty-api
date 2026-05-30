const Joi = require('joi')
const Hoek = require('@hapi/hoek')
const {Message, Routines} = require('@dataparty/crypto')
const debug = require('debug')('dataparty.endpoint.create-package')

const IEndpoint = require('../../service/iendpoint')

module.exports = class CreatePkgEndpoint extends IEndpoint {

  static get Name(){
    return 'create-package'
  }


  static get Description(){
    return 'Create venue package'
  }

  /*
  {
    venue_package: {
      package:{
        owner: String,
        info: {
          name, version, githash, branch
        },
        files: [      //package, service, static.tgz, 
          {hash: String, name: String, size: Number, signature}
        ],
        statics: {
          PREFIX: [localPathGlob]
        }
      },
      trust: {
        owner: signature
      }
      
    }
  }

  {
    venue_project: {

      project:{

        owner: String,
        domain: String,
        venue: String,

        parties: {
          NAME: {
            keys: {public, private: Secret(private)},
            defaultConfig: Object,
            files: [      //static.tgz, 
              {hash: String, name: String, signature}
            ],
            statics: {prefix, [localPath]}
          }
        },


        
        
        routes: {
          PREFIX: [{
            party: String,
            package: {
              owner: String,
              info: {name, version, branch, githash},
              settings: {
                sendFullErrors,
                useNative
              }
            }
          }]
        }
      },
      trust: {
        owner: signature
      }
    }
  }

  */

  static get MiddlewareConfig(){
    return {
      pre: {
        decrypt: true,
        ephemeral_session: true,
        //validate: Joi.object().keys(null)
        validate: Joi.object().keys({
          /*settings: Joi.object().keys({
            enabled: Joi.boolean().default(true).required(),
            //domain: Joi.string().required(),
            staticPrefix: Joi.string().default('/'),
            sendFullErrors: Joi.boolean().default(false).required(),
            useNative: Joi.boolean().default(false).required()
          }).required(),*/
          build: Joi.object().keys({
            package: Joi.object().keys({
              owner: Joi.string(),
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
            files: Joi.object().keys(null),
            signatures: Joi.object().keys(null).required(),
            compileSettings: Joi.object().keys(null)
          }).required(),
          staticTar: Joi.binary()
        })
      },
      post: {
        encrypt: true,
        validate: Joi.object().keys(null).description('any output allowed')
      }
    }
  }

  static async run(ctx){

    

    ctx.debug('hello')
    debug('echo')
    ctx.debug('ctx.input', ctx.input)


    //verify sender is admin
    const isAdmin = await ctx.runner.auth.isAdmin(actorIdentity)
    if(!isAdmin){
      ctx.debug('non-admin user')
      return {done: false}
    }

    // verify build signature


    // untar listed files

    // verify static file checksums match verified signatures

    // create db entry

    /*

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
    }*/

      return {done: true}

    //return {srv:srvDoc.data}
  }
}