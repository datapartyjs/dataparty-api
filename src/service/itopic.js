const debug = require('debug')('dataparty.service.ITopic')

module.exports = class ITopic {

  /**
   * Interface class for Topics
   * 
   * @interface module:Service.ITopic
   * @link module:Service
   */
  constructor({context}){
    this.context = {
      party: context.party,
      serviceRunner: context.serviceRunner
    }
  }

  /**
   * @type {string}
   * @member module:Service.ITopic.Name
   */
  static get Name(){
    throw new Error('not implemented')
  }

  /**
   * @type {string}
   * @member module:Service.ITopic.Description
   */
  static get Description(){
    throw new Error('not implemented')
  }

  async canAdvertise(identity, args){
    throw new Error('not implemented')
  }

  async canPublish(identity, args){
    throw new Error('not implemented')
  }

  async canSubscribe(identity, args){
    throw new Error('not implemented')
  }

  /**
   * @typedef {Object} module:Service.ITopic.Info
   * @property {string} Name
   * @property {string} Description
   */

  /**
   * Returns the task's `Name`, `Description`, and `Config`
   * @type module:Service.ITopic.Info
   * @member module:Service.ITopic.info
   */
  static get info(){
    return {
      Name: this.Name,
      Description: this.Description
    }
  }
}