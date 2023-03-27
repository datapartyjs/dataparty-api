const debug = require('debug')('bouncer.ISchema')
const MgoUtils = require('../utils/mongoose-scheme-utils')

module.exports = class ISchema {

  /**
   * @interface module:Db.ISchema
   * @link module.Db
   */
  constructor(){ }

  /**
   * @method module:Db.ISchema.install
   * @param {*} mongoose 
   * @returns 
   */
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

  /**
   * @method module:Db.ISchema.setupSchema
   * @param {*} schema 
   * @returns 
   */
  static setupSchema(schema){
    return schema
  }

  static get Schema (){
    throw new Error('not implemented')
  }

  static get Type (){
    throw new Error('not implemented')
  }

  static get Utils(){
    return MgoUtils
  }

  /*static get Class(){
    throw new Error('not implemented')
  }*/

  /**
   * Collection level read/new/change permissions
   * @method module:Db.ISchema.permissions
   * @param {*} context 
   */
  static async permissions(context){
    throw new Error('not implemented')
  }

  /**
   * Collection level read redaction
   * @param {Object} msg msg object
   * @param {} context 
   */
  static redactRead(msg, context){
    return msg
  }

    /**
   * Collection level read redaction
   * @param {Object} msg msg object
   * @param {} context 
   */
  static redactWrite(msg, context){
    return msg
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
