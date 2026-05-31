const fs = require('fs')
const Joi = require('joi')
const Hoek = require('@hapi/hoek')
const {Message, Routines, Identity} = require('@dataparty/crypto')
const debug = require('debug')('dataparty.endpoint.create-package')
const zlib = require('zlib')

const IEndpoint = require('../../service/iendpoint')

const typedArraySchema = (value, helpers) => {
  // 1. Ensure the value is an instance of a TypedArray (e.g., Uint8Array)
  if (!(value instanceof Uint8Array)) {
    return helpers.message({ custom: '"value" must be a Uint8Array' });
  }

  return value
}

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
        validate: Joi.object().keys({
          settings: Joi.object().keys({
            //enabled: Joi.boolean().default(true).required(),
            //domain: Joi.string().required(),
            staticPrefix: Joi.string().default('/'),
            sendFullErrors: Joi.boolean().default(false),
            useNative: Joi.boolean().default(false),
            defaultConfig: Joi.object().keys(null)
          }),
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
          //staticTar: Joi.binary()
          staticTar: Joi.any().custom(typedArraySchema)
        })
      },
      post: {
        encrypt: true,
        validate: Joi.object().keys(null).description('any output allowed')
      }
    }
  }

  static async run(ctx){

    let {signatures, ...buildWithoutSig} = ctx.input.build

    const pkgOwnerIdentityDoc = (await ctx.party.find()
      .type('public_key')
      .where('hash').equals( ctx.input.build.package.owner )
      .exec()
    )[0]

    if(!pkgOwnerIdentityDoc){
      throw new Error('package owner not authorized')
    }

    debug('found pkg owner', pkgOwnerIdentityDoc.hash)

    const pkgOwnerIdentity = Identity.fromJSON({
      id: '',
      key: {
        type: pkgOwnerIdentityDoc.data.type,
        hash: pkgOwnerIdentityDoc.data.hash,
        public: pkgOwnerIdentityDoc.data.public
      }
    })


    debug('inflated identity')

    //debug('build', buildWithoutSig)
    
    const devSig = Routines.Utils.base64.decode(signatures[ctx.input.build.package.owner])

    let signedBuildMsg = new Message({
      msg: buildWithoutSig,
      sig: devSig
    })

    debug('sigs', signatures)

    debug('verifying package signature')

    await signedBuildMsg.assertVerified(pkgOwnerIdentity, true)

    debug('verified package signature')

    const tarHash = Routines.Utils.hash(ctx.input.staticTar)
    const tarHash64 = Routines.Utils.base64.encode( tarHash )

    const safeFileName = ctx.input.build.package.name.replace('/', '-')
    const tarFileName = safeFileName+'.files.venue.tgz'

    const buildFiles = ctx.input.build.files[tarFileName]

    if(buildFiles && buildFiles.hash != tarHash64){
      throw new Error("staticTar hash doesn't match package definition")
    }

    debug('verified staticTar')

    debug('verified package - '+ctx.input.build.package.name+'@'+ctx.input.build.package.version)

    const buildBSON = Routines.BSON.serializeBSONWithoutOptimiser(/*ctx.input.build*/buildWithoutSig)

    const buildHash = Routines.Utils.base64.encode(
      Routines.Utils.hash(
        buildBSON
      )
    )

    const safeBuildHash = buildHash.replace(/\//g, "-")

    debug('\t'+'hash', buildHash)

    const buildWorkspace = 'packages/'+safeFileName+'/'+ctx.input.build.package.version+'/'+safeBuildHash

    const config = ctx.party.config

    const workspacePath = await config.touchDir(buildWorkspace)

    
    debug('\t'+'workspace - local', buildWorkspace)
    debug('\t'+'workspace - global', workspacePath)
    


    const compressedBrotliBuild = zlib.brotliCompressSync(JSON.stringify(ctx.input.build))
    
    const build = ctx.input.build
    const serviceId = build.package.name + '@' + build.package.version
    debug('addService', serviceId)

    let srvDoc = (await ctx.party.find()
    .type('venue_pkg')
    .where('package.name').equals(build.package.name)
    .where('package.version').equals(build.package.version)
    .where('hash').equals(buildHash)
    .exec())[0]


    if(!srvDoc){
      debug('creating service')

      const {owner, ...pkgWithoutOwner} = build.package

      srvDoc = await ctx.party.createDocument('venue_pkg', {
        owner: build.package.owner,
        'created': Date.now(),
        venue: ctx.party.identity.key.hash,
        hash: buildHash,
        workspace: workspacePath,
        settings: ctx.input.settings,
        package: pkgWithoutOwner,
        compressedBuild: Routines.Utils.base64.encode(compressedBrotliBuild)
      })

      debug('service created')
    } else {
      debug('need to update service')
    }

    fs.writeFileSync(
      Path.join(workspacePath, tarFileName),
      ctx.input.staticTar
    )

    /*fs.writeFileSync(
      Path.join(workspacePath, safeFileName+'.service.venue.bson'),
      Routines.BSON.serializeBSONWithoutOptimiser(ctx.input.build)
    )*/

    fs.writeFileSync(
      Path.join(workspacePath, safeFileName+'.service.venue.json'),
      JSON.stringify(ctx.input.build, null, 2)
    )
    
    // verify build signature

    //ctx.input.

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