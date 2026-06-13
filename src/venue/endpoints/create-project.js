const fs = require('fs')
const Joi = require('joi')
const Hoek = require('@hapi/hoek')
const {Message, Routines, Identity} = require('@dataparty/crypto')
const debug = require('debug')('dataparty.endpoint.create-project')
const zlib = require('zlib')

const IEndpoint = require('../../service/iendpoint')

const typedArraySchema = (value, helpers) => {
  // 1. Ensure the value is an instance of a TypedArray (e.g., Uint8Array)
  if (!(value instanceof Uint8Array)) {
    return helpers.message({ custom: '"value" must be a Uint8Array' });
  }

  return value
}

module.exports = class CreateProjectEndpoint extends IEndpoint {

  static get Name(){
    return 'create-project'
  }


  static get Description(){
    return 'Create venue project'
  }

  

  static get MiddlewareConfig(){
    return {
      pre: {
        decrypt: true,
        ephemeral_session: true,
        validate: Joi.object().keys({
          project: Joi.object().keys({
            owner: Joi.string(),
            created: Joi.number(),
            changed: Joi.number(),
            
            name: Joi.string(),
            venue: Joi.string(),
            domain: Joi.string(),

            i2p: Joi.object().keys({
              address: Joi.string(),
              public: Joi.string(),
              securePrivate: Joi.string()
            }),
            party: Joi.array().items(Joi.object().keys({
              name: Joi.string(),
              type: Joi.string(),
              tingo: { path: Joi.string() },
              loki: { path: Joi.string() },
              peer: {
                venue: Joi.string(),
                remoteIdentity: Joi.string()
              },
              key: {
                hash: Joi.string(),
                securePrivate: Joi.string()
              },
              settings: { noCache: Joi.string() },
              defaultConfig: Joi.string()
            })),
            routes: Joi.array().items(Joi.object().keys({
              prefix: Joi.string(),
              party: Joi.string(),
              package: Joi.object().keys({
                owner: Joi.string(),
                name: Joi.string().required(),
                version: Joi.string(),
                branch: Joi.string(),
                hash: Joi.string()
              }),
              settings: {
                sendFullErrors: Joi.boolean().required(),
                useNative: Joi.boolean().required()
              }
            })),
            files: Joi.object().pattern(Joi.string(), Joi.object().keys({
              tar: Joi.string(),
              hash: Joi.string().required(),
              size: Joi.number().required(),
              files: Joi.object().pattern(Joi.string(), Joi.object().keys({
                hash: Joi.string().required(),
                size: Joi.number().required()
              }))
            }))
          }).required(),
          signatures: Joi.object().pattern(Joi.string(), Joi.string()).required(),
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

    if(ctx.party.identity.key.hash != ctx.input.project.hash){
      throw new Error('project venue does not match this host')
    }

    let {signatures, ...projectWithoutSig} = ctx.input.project

    const projectOwnerIdentityDoc = (await ctx.party.find()
      .type('public_key')
      .where('hash').equals( ctx.input.project.owner )
      .exec()
    )[0]

    if(!projectOwnerIdentityDoc){
      throw new Error('project owner not authorized')
    }

    debug('found project owner', projectOwnerIdentityDoc.hash)

    const projectOwnerIdentity = Identity.fromJSON({
      id: '',
      key: {
        type: projectOwnerIdentityDoc.data.type,
        hash: projectOwnerIdentityDoc.data.hash,
        public: projectOwnerIdentityDoc.data.public
      }
    })


    debug('inflated identity')
    
    const devSig = Routines.Utils.base64.decode(signatures[ctx.input.project.owner])

    let signedProjectMsg = new Message({
      msg: projectWithoutSig,
      sig: devSig
    })

    debug('sigs', signatures)

    debug('verifying package signature')

    await signedProjectMsg.assertVerified(projectOwnerIdentity, true)

    debug('verified package signature')

    const tarHash = Routines.Utils.hash(ctx.input.staticTar)
    const tarHash64 = Routines.Utils.base64.encode( tarHash )

    const safeFileName = ctx.input.project.name.replace('/', '-')
    const tarFileName = safeFileName+'.files.venue.tgz'

    const projectFiles = ctx.input.project.files[tarFileName]

    if(projectFiles && projectFiles.hash != tarHash64){
      throw new Error("staticTar hash doesn't match project definition")
    }

    debug('verified staticTar')

    debug('verified project - '+ctx.input.project.name+'@'+ctx.input.project.version)

    const projectBSON = Routines.BSON.serializeBSONWithoutOptimiser(projectWithoutSig)

    const projectHash = Routines.Utils.base64.encode(
      Routines.Utils.hash(
        projectBSON
      )
    )

    const safeProjectHash = projectHash.replace(/\//g, "-")

    debug('\t'+'hash', projectHash)

    const projectWorkspace = 'projects'+safeFileName+'/'+ctx.input.project.version+'/'+safeProjectHash

    const config = ctx.party.config

    const workspacePath = await config.touchDir(projectWorkspace)

    
    debug('\t'+'workspace - local', projectWorkspace)
    debug('\t'+'workspace - global', workspacePath)
    


    const compressedBrotliBuild = zlib.brotliCompressSync(JSON.stringify(ctx.input.project))
    
    const project = ctx.input.project
    const projectId = project.name + '@' + project.version
    debug('addProject', projectId)

    let projectDoc = (await ctx.party.find()
    .type('venue_project')
    .where('project.name').equals(project.name)
    .where('project.version').equals(project.version)
    .where('hash').equals(projectHash)
    .exec())[0]


    if(!projectDoc){
      debug('creating project')

      const {owner, ...pkgWithoutOwner} = project.package

      projectDoc = await ctx.party.createDocument('venue_pkg', {
        owner: project.owner,
        created: Date.now(),
        hash: projectHash,
        workspace: workspacePath,
        project: ctx.input.project,
        signatures: ctx.input.signatures
      })

      debug('project created')
    } else {
      debug('need to update project?')
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
      Path.join(workspacePath, safeFileName+'.project.venue.json'),
      JSON.stringify(ctx.input.build, null, 2)
    )
    
    // verify build signature

    //ctx.input.

    // untar listed files

    // verify static file checksums match verified signatures

    // create db entry

    /*

    const compiledSrv = JSON.parse(ctx.input.service)
    const projectId = compiledSrv.package.name + '-' + compiledSrv.package.version
    debug('addService', projectId)

    let projectDoc = (await ctx.party.find()
    .type('venue_srv')
    .where('name').equals(compiledSrv.package.name)
    .exec())[0]

    

    if(!projectDoc){
      debug('creating service')
      projectDoc = await ctx.party.createDocument('venue_srv', {
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
        debug(projectDoc.data)
        await projectDoc.mergeData({
          package: compiledSrv.package,
          schemas: compiledSrv.schemas,
          endpoints: compiledSrv.endpoints,
          midddleware: compiledSrv.middleware,
          middleware_order: compiledSrv.middleware_order
        })
  
        //debug(projectDoc.data)
  
        debug('saving doc')


        await projectDoc.save()
      }
      catch(err){
        console.log(err)
      }
      debug('updated service')
    }*/

      return {done: true}

    //return {srv:projectDoc.data}
  }
}