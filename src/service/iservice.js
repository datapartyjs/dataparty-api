const fs = require('fs')
const Path = require('path')
const NCC = require('@zeit/ncc')
const debug = require('debug')('dataparty.service.IService')

module.exports = class IService {
  constructor({
    name, version
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
      package: { name, version },
      documents: {},
      endpoints: {},
      middleware: {
        pre: {},
        post: {}
      }
    }
   }


  async compile(outputPath){

    if(!outputPath){
      throw new Error('no output path')
    }


    await Promise.all([
      this.compileMiddleware('pre'),
      this.compileMiddleware('post'),
      this.compileList('documents'),
      this.compileList('endpoints')
    ])

    const buildOutput = outputPath+'/'+ this.compiled.package.name.replace('/', '-') +'.dataparty-service.json'
    fs.writeFileSync(buildOutput, JSON.stringify(this.compiled))

    return this.compiled

  }

  async compileList(field, outputPath){
    // Build file list
    debug('compileList',field)
    debug(this.sources)
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
      //externals: ["externalpackage"],
      // directory outside of which never to emit assets
      //filterAssetBase: process.cwd(), // default
      minify: false, // default
      sourceMap: false, // default
      //sourceMapBasePrefix: '../', // default treats sources as output-relative
      // when outputting a sourcemap, automatically include
      // source-map-support in the output file (increases output by 32kB).
      sourceMapRegister: true, // default
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

  /**
   * 
   * @param {dataparty.service.ISchema} schema_path 
   */
  addSchema(schema_path){
    const schema = require(schema_path)
    const name = schema.Type

    this.sources.schemas[name] = schema_path
    this.constructors.schemas[name] = schema
  }

  addDocument(document_path){
    const document = require(document_path)
    const name = document.DocumentSchema

    this.sources.documents[name] = document_path
    this.constructors.documents[name] = document
  }

  addEndpoint(endpoint_path){
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

  async start(){
    //
  }

  async run(context){

  }
}
