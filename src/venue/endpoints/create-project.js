const fs = require('fs')
const Joi = require('joi')
const Path = require('path')
const Hoek = require('@hapi/hoek')
const {Message, Routines, Identity} = require('@dataparty/crypto')
const debug = require('debug')('dataparty.endpoint.create-project')

const process = require('process')
const tar = require('tar')
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
            owner: Joi.string().required(),
            //created: Joi.number(),
            
            name: Joi.string().required(),
            version: Joi.string().required(),
            venue: Joi.string().required(),
            domain: Joi.string(),

            data: {
              copyPrevious: Joi.boolean().default(true)
            },

            hosting: Joi.object().keys({

              http: Joi.object().keys({
                listenUri: Joi.string(),
                cors: Joi.object(),
                mdnsEnabled: Joi.boolean(),
                mdnsName: Joi.string(),
                trust_proxy: Joi.boolean(),
                wsEnabled: Joi.boolean(),
                secureSSL: Joi.string(),
                generateSSLKey: Joi.boolean(),
              }),

              i2p: Joi.object().keys({
                generateKey: Joi.boolean(),
                address: Joi.string(),
                public: Joi.string(),
                securePrivate: Joi.string()
              }),

              p2p: Joi.array().items({
                matchMakerHash: Joi.string(),
                identityParty: Joi.string()
              }),

              ble: Joi.boolean()
            }),

            
            party: Joi.array().items(Joi.object().keys({
              name: Joi.string(),
              db: Joi.string().required(),
              tingo: { path: Joi.string() },
              zango: { dbname: Joi.string() },
              mongo: {
                uri: Joi.string(),
                mongoOptions: Joi.object(),
                secureUri: Joi.string()
              },
              loki: { 
                dbAdapter: Joi.string(),
                path: Joi.string()
              },
              peer: {
                venue: Joi.string(),
                remoteIdentity: Joi.string()
              },
              key: {
                generateKey: Joi.boolean(),
                hash: Joi.string(),
                securePrivate: Joi.string()
              },
              settings: { noCache: Joi.boolean() },
              defaultConfig: Joi.object()
            })),
            routes: Joi.array().items(Joi.object().keys({
              prefix: Joi.string(),
              staticPath: Joi.string(),
              party: Joi.string(),
              package: Joi.object().keys({
                owner: Joi.string(),
                name: Joi.string().required(),
                version: Joi.string(),
                branch: Joi.string(),
                hash: Joi.string().max(100)
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
            })),
            signatures: Joi.object().pattern(Joi.string(), Joi.string()).required()
          }).required(),
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

    if(ctx.party.identity.key.hash != ctx.input.project.venue){
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

    const safeFileName = ctx.input.project.name.replace('/', '-')
    const tarFileName = safeFileName+'.project.files.venue.tgz'

    const projectFiles = ctx.input.project.files[tarFileName]

    if(projectFiles && !ctx.input.staticTar){
      throw new Error('project definition lists a static tar but none was uploaded')
    }

    if(ctx.input.staticTar){
      const tarHash = Routines.Utils.hash(ctx.input.staticTar)
      const tarHash64 = Routines.Utils.base64.encode( tarHash )
      
      if(projectFiles && projectFiles.hash != tarHash64){
        throw new Error("staticTar hash doesn't match project definition")
      }

      debug('verified staticTar')
    }

    // check route packages are valid
    let packages = {}
    let tarList = []

    for(let route of ctx.input.project.routes){

      console.log(route)

      if(!route.package || !route.package.name){continue}

      let pkgDoc = (await ctx.party.find()
        .type('venue_pkg')
        .or()
        .where('package.name').equals(route.package.name)
        .where('package.githash').equals(route.package.githash)
        .sort('-created')
        .limit(1)
        .exec())[0]
      
      if(!pkgDoc){
        throw new Error(`package ${JSON.stringify(route.package)} not found. required by ${route.prefix}`)
      }

      const {compressedBuild, ...printablePkg} = pkgDoc.data

      console.log('found package', printablePkg)

      let pkgTarPath = pkgDoc.data.tarpath

      if(pkgTarPath && pkgTarPath.length > 0){
        tarList.push(pkgTarPath)
      }

      packages[route.prefix] = pkgDoc.data
    }


    debug('verified project - '+ctx.input.project.name+'@'+ctx.input.project.version)

    const projectBSON = Routines.BSON.serializeBSONWithoutOptimiser(projectWithoutSig)

    const projectHash = Routines.Utils.base64.encode(
      Routines.Utils.hash(
        projectBSON
      )
    )

    const safeProjectHash = projectHash.replace(/\//g, "-").replace(/=/g, "_")

    debug('\t'+'hash', projectHash)

    const projectWorkspace = Path.join('projects/',safeFileName, ctx.input.project.version, safeProjectHash)

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
      .where('hash').equals(safeProjectHash)
      .exec())[0]


    if(!projectDoc){
      debug('creating project')

      const {owner, ...pkgWithoutOwner} = project

      projectDoc = await ctx.party.createDocument('venue_project', {
        owner: project.owner,
        created: Date.now(),
        changed: Date.now(),
        hash: safeProjectHash,
        workspace: workspacePath,
        tarpath: Path.join(workspacePath, tarFileName),
        project: ctx.input.project,
      })

      debug('project created')
    } else {
      debug('need to update project?')
    }

    debug('extracting other tars', tarList)

    for(let tarPath of tarList){
      debug('extracting', tarPath)

      await tar.extract({
        cwd: workspacePath,
        file: tarPath,
        newer: true,
        unlink: true,
        uid: process.getuid(),
        gid: process.getgid()
      }, /*tarFileList*/ )
    }

    if(ctx.input.staticTar){ 
      debug('saving tar file', tarFileName)
      fs.writeFileSync(
        Path.join(workspacePath, tarFileName),
        ctx.input.staticTar
      )

      debug('extracting contents')

      /*await tar.t({
        cwd: workspacePath,
        file: Path.join(workspacePath, tarFileName),
        onReadEntry: entry => { console.log('\t\t', entry) }
      })*/

      //const tarFileInfo = projectDoc.data.project.files[ tarFileName ]

      //if(projectFiles){
        const tarFileList = Object.keys(projectFiles.files)

        debug('file list - ', tarFileList)

        await tar.extract({
          cwd: workspacePath,
          file: Path.join(workspacePath, tarFileName),
          newer: true,
          unlink: true,
          uid: process.getuid(),
          gid: process.getgid()
        }, tarFileList )

      //}
    }

    /*fs.writeFileSync(
      Path.join(workspacePath, safeFileName+'.service.venue.bson'),
      Routines.BSON.serializeBSONWithoutOptimiser(ctx.input.build)
    )*/

    fs.writeFileSync(
      Path.join(workspacePath, safeFileName+'.project.venue.json'),
      JSON.stringify(ctx.input.project, null, 2)
    )

    await ctx.party.config.write('projects.'+ctx.input.project.name, projectHash)
    
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

      return {done: true, project: projectDoc.data}

    //return {srv:projectDoc.data}
  }
}
