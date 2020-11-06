const fs = require('fs')
const Path = require('path')

const Hoek = require('@hapi/hoek')
const {JSONPath} = require('jsonpath-plus')
const gitRepoInfo = require('git-repo-info')
const debug = require('debug')('build.model')
const BouncerDb = require('@dataparty/bouncer-db')
const json2ts = require('json-schema-to-typescript')

const mongoose = BouncerDb.mongoose

const buildSchema = async function(
  {
    name,
    service,
    outputPath='./dist',
    buildTypeScript=false,
    writeFiles=false
  }={}
){
  const Model = require(servicePath)

  const output = {
    Package: {},
    IndexSettings: {},
    JSONSchema: [],
    Permissions: {}
  }
  
  output.Package.name = service.name
  output.Package.version = service.version

  if(servicePath){
    
    const info = gitRepoInfo(Path.dirname(servicePath))

    output.Package.githash = refs.HEAD
  }

  const tsWrites = []
  const tsOutput = {}

  for(let key in Model.Types){
    const model = Model.Types[key]
    let schema = mongoose.Schema(model.Schema)
    schema = model.setupSchema(schema)
    let jsonSchema = schema.jsonSchema()

    jsonSchema.title = model.Type

    output.Permissions[model.Type] = await model.permissions()
    output.JSONSchema.push(jsonSchema)

    debug('\t','type',model.Type)

    let indexed = JSONPath({
      path: '$..options.index',
      json:schema.paths,
      resultType: 'pointer'
    }).map(p=>{return p.split('/')[1]})

    debug('\t\tindexed', indexed)

    let unique = JSONPath({
      path: '$..options.unique',
      json:schema.paths,
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

    output.IndexSettings[model.Type] = {
      indices: indexed,
      unique,
      compoundIndices
    }

    if(buildTypeScript){
      
      const tsWrite = json2ts.compile(jsonSchema).then( ts=>{
        tsOutput[model.Type] = ts
        const tsPath = Path.join(outputPath, model.Type + '.d.ts')
        if(writeFiles){ fs.writeFileSync(tsPath, ts) }
      })
      
      tsWrites.push(tsWrites)
      
    }

  }
  
  if(buildTypeScript){ await Promise.all(tsWrites) }
  
  const jsonSchemaStr = JSON.stringify(output, null, 2)
  const jsonSchemaPath = Path.join(outputPath, name+'-model.json')

  if(writeFiles){ fs.writeFileSync(jsonSchemaPath, jsonSchemaStr) }
  
  return {
    SchemePath: jsonSchemaPath,
    JSON: jsonSchemaStr,
    JSONSchema: output.JSONSchema,
    IndexSettings: output.IndexSettings,
    TypeScript: tsOutput
  }
}

module.exports = buildSchema