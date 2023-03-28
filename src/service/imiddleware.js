const debug = require('debug')('dataparty.service.IMiddleware')

/**
 * @interface module:Service.IMiddleware
 * @link module:Service
 */
module.exports = class IMiddleware {

  /**
   * @type string
   * @member module:Service.IMiddleware.Name
   */
  static get Name(){
    throw new Error('not implemented')
  }

  /**
   * Type of middleware. Allowed values are `pre` or `post`
   * @type {'pre' or 'post'}
   * @member module:Service.IMiddleware.Type
   */
  static get Type(){
    throw new Error('not implemented - pre or post')
  }

  /**
   * @type string
   * @member module:Service.IMiddleware.Description
   */
  static get Description(){
    throw new Error('not implemented')
  }

  /**
   * Joi validator that describes any expected config for this middleware
   * @type {Object}
   * @member module:Service.IMiddleware.ConfigSchema
   */
  static get ConfigSchema(){
    throw new Error('not implemented')
  }

  /**
   * @async
   * @method module:Service.IMiddleware.start
   * @param {module:Party.IParty} party 
   */
  static async start(party){

  }

  /**
   * @async
   * @method module:Service.IMiddleware.run
   * @param {module:Service.EndpointContext} context 
   * @param {*} options.Config  The config options set for this instance of middleware
   */
  static async run(context, {Config}){
    throw new Error('not implemented')
  }


  /**
   * @typedef {Object} module:Service.IMiddleware.MiddlewareInfo
   * @property {string} Name
   * @property {string} Type
   * @property {string} Description
   * @property {Object} ConfigSchema
   */

  /**
   * @type module:Service.IMiddleware.MiddlewareInfo
   * @member module:Service.IMiddleware.info
   */
  static get info(){
    return {
      Name: this.Name,
      Type: this.Type,
      Description: this.Description,
      ConfigSchema: this.ConfigSchema
    }
  }
}