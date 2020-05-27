const debug = require('debug')('dataparty.service.ISchema')


module.exports = class ISchema {
  constructor(){ }

  static install(mongoose){
    debug('install - ', this.Type)

    let schema = mongoose.Schema(this.Schema)

    /*schema =*/ this.setupSchema(schema)

    schema.loadClass(this)

    const name = this.Type
    const title = 'api_' + name

    let model = mongoose.model(title, schema, title)

    return { schema, model }
  }

  static setupSchema(schema){
    return schema
  }

  static get Schema (){
    throw new Error('not implemented')
  }

  static get Type (){
    throw new Error('not implemented')
  }

  /*static get Class(){
    throw new Error('not implemented')
  }*/

  /**
   * Collection level read/new/change permissions
   * @param {*} context 
   */
  static async permissions(context){
    throw new Error('not implemented')
  }

  static generate({JSONSchema, IndexSettings, Permissions}){

    return class GenericModel extends Schema {
    
      static get Schema(){
        return {
          'ajv-schema': JSONSchema
        }
      }
  
      static get Type(){
        return JSONSchema.title
      }
    
      static async permissions(){
        return Permissions
      }
    }
  }
}
