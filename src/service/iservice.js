const fs = require('fs')
const Path = require('path')
const NCC = require('@zeit/ncc')
const Hoek = require('@hapi/hoek')
const {JSONPath} = require('jsonpath-plus')
const gitRepoInfo = require('git-repo-info')
const BouncerDb = require('@dataparty/bouncer-db')
const mongoose = BouncerDb.mongoose()
const json2ts = require('json-schema-to-typescript')
const debug = require('debug')('dataparty.service.IService')

module.exports = class IService {
  constructor({
    name, version, githash='', branch=''
  }){

    this.constructors = {
      schemas: {},
      documents: {},
      endpoints: {},
      middleware: {
        pre: {},
        post: {}
      }
    }

    this.middleware_order = {
      pre: [],
      post: []
    }

    this.sources = {
      schemas: {},
      documents: {},
      endpoints: {},
      middleware: {
        pre: {},
        post: {}
      }
    }

    this.compiled = {
      package: { name, version, githash, branch },
      schemas: {
        IndexSettings: {},
        JSONSchema: [],
        Permissions: {}
      },
      documents: {},
      endpoints: {},
      middleware: {
        pre: {},
        post: {}
      },
      middleware_order: {
        pre: [],
        post: []
      }
    }
   }


  /**
   * 
   * @param {dataparty.service.ISchema} schema_path 
   */
  addSchema(schema_path){
    debug('addSchema', schema_path)
    const schema = require(schema_path)
    const name = schema.Type

    this.sources.schemas[name] = schema_path
    this.constructors.schemas[name] = schema
  }

  addDocument(document_path){
    debug('addDocument', document_path)
    const document = require(document_path)
    const name = document.DocumentSchema

    this.sources.documents[name] = document_path
    this.constructors.documents[name] = document
  }

  addEndpoint(endpoint_path){
    debug('andEndpoint', endpoint_path)
    const endpoint = require(endpoint_path)
    const name = endpoint.Name

    this.sources.endpoints[name] = endpoint_path
    this.constructors.endpoints[name] = endpoint
  }

  addMiddleware(middleware_path){

    debug('addMiddleware',middleware_path)

    const middleware = require(middleware_path)


    const name = middleware.Name 
    const type = middleware.Type

    debug('addMiddleware',type,name)

    this.middleware_order[type].push(name)

    this.sources.middleware[type][name] = middleware_path
    this.constructors.middleware[type][name] = middleware
  }


  async compile(outputPath, writeFile=true){

    if(!outputPath){
      throw new Error('no output path')
    }

    const info = gitRepoInfo(Path.dirname(outputPath))

    this.compiled.package.githash = info.sha
    this.compiled.package.branch = info.branch

    debug('compiling sources',this.sources)

    await Promise.all([
      this.compileMiddleware('pre'),
      this.compileMiddleware('post'),
      this.compileList('documents'),
      this.compileList('endpoints'),
      this.compileSchemas()
    ])

    this.compiled.middleware_order = this.middleware_order

    if(writeFile){
      const buildOutput = outputPath+'/'+ this.compiled.package.name.replace('/', '-') +'.dataparty-service.json'
      fs.writeFileSync(buildOutput, JSON.stringify(this.compiled, null,2))

      const schemaOutput = outputPath+'/'+ this.compiled.package.name.replace('/', '-') +'.dataparty-schema.json'
      fs.writeFileSync(schemaOutput, JSON.stringify({
        package: this.compiled.package,
        ...this.compiled.schemas
      }))
    }

    return this.compiled

  }

  async compileList(field, outputPath){
    // Build file list
    debug('compileList',field)
    for(const name in this.sources[field]){
      debug('\r', field, name)

      const buildPath = !outputPath ? '' : Path.join(outputPath, field+'-'+name)
      const build = await this.compileFileTo(this.sources[field][name], buildPath)

      this.compiled[field][name] = build

    }
  }

  async compileMiddleware(type,outputPath){
    // Build pre middleware
    for(const name of this.middleware_order[type]){
      debug('\r', type, name)

      const buildPath = !outputPath ? '' : Path.join(outputPath, 'middleware-'+type+'-'+name)
      const build = await this.compileFileTo(this.sources.middleware[type][name], buildPath)

      this.compiled.middleware[type][name] = build

    }
  }

  async compileFileTo(input, output){
    const { code, map, assets } = await NCC(input, {
      // provide a custom cache path or disable caching
      cache: false,
      // externals to leave as requires of the build
      externals: ['debug', '@dataparty/crypto', '@hapi/joi', '@hapi/hoek'],
      // directory outside of which never to emit assets
      //filterAssetBase: process.cwd(), // default
      minify: true, // default
      sourceMap: true, // default
      //sourceMapBasePrefix: '../', // default treats sources as output-relative
      // when outputting a sourcemap, automatically include
      // source-map-support in the output file (increases output by 32kB).
      sourceMapRegister: false, // default
      watch: false, // default
      v8cache: false, // default
      quiet: false, // default
      debugLog: false // default
    })

    debug('compileFileTo', input, '->', output)
    debug('\t','code length', Math.round(code.length/1024), 'KB')

    if(output){
      fs.writeFileSync(output+'.js', code)
    }

    return {code, map, assets}
  }


  async compileSchemas(buildTypeScript=false){
    debug('compileSchema')
    for(let key in this.constructors.schemas){
      debug('\tcompiling', key)
      const model = this.constructors.schemas[key]
      let schema = mongoose.Schema(model.Schema)
      schema = model.setupSchema(schema)
      let jsonSchema = schema.jsonSchema()
  
      jsonSchema.title = model.Type
  
      this.compiled.schemas.Permissions[model.Type] = await model.permissions()
      this.compiled.schemas.JSONSchema.push(jsonSchema)
  
      debug('\t','type',model.Type)
  
      let indexed = JSONPath({
        path: '$..options.index',
        json: schema.paths,
        resultType: 'pointer'
      }).map(p=>{return p.split('/')[1]})
  
      debug('\t\tindexed', indexed)
  
      let unique = JSONPath({
        path: '$..options.unique',
        json: schema.paths,
        resultType: 'pointer'
      }).map(p=>{
        debug(typeof p)
        if(typeof p == 'string'){
          return p.split('/')[1]
        }
        
        return p
      })
  
      debug('\t\tunique', unique)
  
      debug('\t\tindexes', schema._indexes)
  
      let compoundIndices = {
        indices: Hoek.reach(schema, '_indexes.0.0'),
        unique: Hoek.reach(schema, '_indexes.0.1.unique')
      }
  
      this.compiled.schemas.IndexSettings[model.Type] = {
        indices: indexed,
        unique,
        compoundIndices
      }
  
      if(buildTypeScript){
        
        const tsWrite = json2ts.compile(jsonSchema).then( ts=>{
          tsOutput[model.Type] = ts
        })
        
        tsWrites.push(tsWrites)
        
      }
  
    }

    if(buildTypeScript){ await Promise.all(tsWrites) }
  }
}
