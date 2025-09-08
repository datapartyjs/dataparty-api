const fs = require('fs')
const Path = require('path')
const Hoek = require('@hapi/hoek')
const NCC = require('@sevenbitbyte/ncc')
const {JSONPath} = require('jsonpath-plus')
const gitRepoInfo = require('git-repo-info')
const BouncerDb = require('@dataparty/bouncer-db')
const mongoose = BouncerDb.mongoose()
const debug = require('debug')('dataparty.service.ServiceBuilder')

//const IService = require('../iservice')


module.exports = class ServiceBuilder {
  constructor(service){
    this.service = service
  }


  /**
   * Compile a service. This will build two output files, one for host usage `-service.json`
   * and another for client usage `-schema.json`.
   * @async
   * @method module:Service.IService.compile
   * @param {string} outputPath   Path where the built service should be written
   * @param {boolean} writeFile   When true, files will be written. Defaults to `true`
   * @returns 
   */
  async compile(outputPath, writeFile=true){

    if(!outputPath){
      throw new Error('no output path')
    }

    const info = gitRepoInfo(Path.dirname(outputPath))

    this.service.compiled.package.githash = info.sha
    this.service.compiled.package.branch = info.branch

    debug('compiling sources',this.service.sources)

    await Promise.all([
      this.compileMiddleware('pre'),
      this.compileMiddleware('post'),
      this.compileList('documents'),
      this.compileList('endpoints'),
      this.compileList('tasks'),
      this.compileList('topics'),
      this.compileSchemas()
    ])

    this.service.compiled.middleware_order = this.service.middleware_order

    this.service.compiled.compileSettings = this.service.compileSettings

    if(writeFile){
      const buildOutput = outputPath+'/'+ this.service.compiled.package.name.replace('/', '-') +'.dataparty-service.json'
      fs.writeFileSync(buildOutput, JSON.stringify(this.service.compiled, null,2))

      const schemaOutput = outputPath+'/'+ this.service.compiled.package.name.replace('/', '-') +'.dataparty-schema.json'
      fs.writeFileSync(schemaOutput, JSON.stringify({
        package: this.service.compiled.package,
        ...this.service.compiled.schemas
      }, null, 2))
    }

    return this.service.compiled

  }


  async compileList(field, outputPath){
    // Build file list
    debug('compileList',field)
    for(const name in this.service.sources[field]){
      debug('\r', field, name)

      const buildPath = !outputPath ? '' : Path.join(outputPath, field+'-'+name)
      const build = await this.compileFileTo(this.service.sources[field][name], buildPath)

      this.service.compiled[field][name] = build

    }
  }

  async compileMiddleware(type,outputPath){
    // Build pre middleware
    for(const name of this.service.middleware_order[type]){
      debug('\r', type, name)

      const buildPath = !outputPath ? '' : Path.join(outputPath, 'middleware-'+type+'-'+name)
      const build = await this.compileFileTo(this.service.sources.middleware[type][name], buildPath)

      this.service.compiled.middleware[type][name] = build

    }
  }

  async compileFileTo(input, output){
    const { code, map, assets } = await NCC(input, this.service.compileSettings)

    debug('compileFileTo', input, '->', output)
    debug('\t','code length', Math.round(code.length/1024), 'KB')

    if(output){
      fs.writeFileSync(output+'.js', code)
    }

    return {code, map, assets}
  }


  async compileSchemas(buildTypeScript=false){
    debug('compileSchema')
    for(let key in this.service.constructors.schemas){
      debug('\tcompiling', key)
      const model = this.service.constructors.schemas[key]
      let schema = mongoose.Schema(model.Schema)
      schema = model.setupSchema(schema)
      let jsonSchema = schema.jsonSchema()
  
      jsonSchema.title = model.Type
  
      this.service.compiled.schemas.Permissions[model.Type] = await model.permissions()
      this.service.compiled.schemas.JSONSchema.push(jsonSchema)
  
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
  
      this.service.compiled.schemas.IndexSettings[model.Type] = {
        indices: indexed,
        unique,
        compoundIndices
      }
  
      if(buildTypeScript){
        throw 'implementation removed'
        /*
        const json2ts = require('json-schema-to-typescript')
        
        const tsWrite = json2ts.compile(jsonSchema).then( ts=>{
          tsOutput[model.Type] = ts
        })
        
        tsWrites.push(tsWrites)
        */
      }
  
    }

    if(buildTypeScript){ await Promise.all(tsWrites) }
  }


  /**
   * Add a dataparty schema implementation to the service
   * @method module:Service.IService.addSchema
   * @param {module:Service.IService} schema_path 
   */
  addSchema(schema_path){
    debug('addSchema', schema_path)
    const schema = require(schema_path)
    const name = schema.Type

    this.service.sources.schemas[name] = schema_path
    this.service.constructors.schemas[name] = schema
  }

  /**
   * Add a document class implementation to the service
   * @method module:Service.IService.addDocument
   * @param {string} document_path 
   */
  addDocument(document_path){
    debug('addDocument', document_path)
    const document = require(document_path)
    const name = document.DocumentSchema

    this.service.sources.documents[name] = document_path
    this.service.constructors.documents[name] = document
  }

  /**
   * Add a dataparty endpoint to the service by pather
   * @method module:Service.IService.addEndpoint
   * @param {string} endpoint_path 
   */
  addEndpoint(endpoint_path){
    debug('addEndpoint', endpoint_path)
    const endpoint = require(endpoint_path)
    const name = endpoint.Name

    this.service.sources.endpoints[name] = endpoint_path
    this.service.constructors.endpoints[name] = endpoint
  }

  /**
   * Add a middleware to this service
   * @method module:Service.IService.addEndpoint
   * @param {string} middleware_path 
   */
  addMiddleware(middleware_path){

    debug('addMiddleware',middleware_path)

    const middleware = require(middleware_path)


    const name = middleware.Name 
    const type = middleware.Type

    debug('addMiddleware',type,name)

    this.service.middleware_order[type].push(name)

    this.service.sources.middleware[type][name] = middleware_path
    this.service.constructors.middleware[type][name] = middleware
  }

  /**
   * Add a `tasker` task implementation to the service
   * @method module:Service.IService.addTask
   * @see https://github.com/datapartyjs/tasker
   * @param {string} task_path 
   */
  addTask(task_path){

    debug('addTask', task_path)

    const TaskClass = require(task_path)

    const name = TaskClass.Name

    this.service.sources.tasks[name] = task_path
    this.service.constructors.tasks[name] = TaskClass
  }

  /**
   * Add a `topic` implementation to the service
   * @method module:Service.IService.addTopic
   * @param {string} topic_path 
   */
  addTopic(topic_path){

    debug('addTopic', topic_path)

    const TopicClass = require(topic_path)

    const name = TopicClass.Name

    this.service.sources.topics[name] = topic_path
    this.service.constructors.topics[name] = TopicClass
  }
}