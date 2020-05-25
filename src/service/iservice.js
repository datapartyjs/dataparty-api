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
   }


  static get Types(){}
  static get Documents(){}

  async compile(){

  }

  /**
   * 
   * @param {dataparty.service.ISchema} schema_path 
   */
  addSchema(schema_path){
    const schema = require(schema_path)
    const name = schema.Type

    this.sources.schema[name] = schema_path
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

  addMiddleware(type='pre', middleware_path){
    const middleware = require(middleware_path)
    const name = middleware.Name 

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
