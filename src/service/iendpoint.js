const debug = require('debug')('dataparty.service.IEndpoint')

/**
 * @interface module:Service.IEndpoint
 * @link module:Service
 */
module.exports = class IEndpoint {

  /**
   * @type string
   * @member module:Service.IEndpoint.Name
   */
  static get Name(){
    throw new Error('not implemented')
  }

  /**
   * @type string
   * @member module:Service.IEndpoint.Description
   */
  static get Description(){
    throw new Error('not implemented')
  }

  /**
   * A collection of pre and post middleware configurations
   * @typedef {Object} module:Service.IEndpoint.EndpointMiddlewareConfig
   * @property {Object<string,Object>} pre  A collection of pre-middleware configuration by name
   * @property {Object<string,Object>} post A collection of post-middleware configuration by name

  /**
   * Collection of configurations to be passed to middleware.
   * Any middleware that is to `true` or an `Object` will be 
   * enabled and will be passed the config assigned here.
   * @type {module:Service.IEndpoint.EndpointMiddlewareConfig}
   * @member module:Service.IEndpoint.MiddlewareConfig
   */
  static get MiddlewareConfig(){
    throw new Error('not implemented')
  }

  /**
   * @method module:Service.IEndpoint.start
   * @param {*} party 
   */
  static async start(party){
    
  }

  /**
   * @async
   * @method module:Service.IEndpoint.run
   * @param {*} context 
   * @param {*} options.Package
   */
  static async run(context, {Package}){
    throw new Error('not implemented')
  }

  /**
   * @typedef {Object} module:Service.IEndpoint.EndpointInfo
   * @property {string} Name
   * @property {string} Description
   * @property {module:Service.IEndpoint.EndpointMiddlewareConfig} MiddlewareConfig
   */



  /**
   * @type {module:Service.IEndpoint.EndpointInfo}
   * @member module:Service.IEndpoint.info
   */
  static get info(){
    return {
      Name: this.Name,
      Description: this.Description,
      MiddlewareConfig: this.MiddlewareConfig
    }
  }
}