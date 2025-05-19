const debug = require('debug')('dataparty.service.IAcl')

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
   * @member module:Service.ITask.Name
   */
  static get Name(){
    throw new Error('not implemented')
  }

  /**
   * @type {string}
   * @member module:Service.ITask.Description
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
   * @typedef {Object} module:Service.ITask.TaskInfo
   * @property {string} Name
   * @property {string} Description
   * @property {module:Service.ITask.TaskConfig} Config
   */

  /**
   * Returns the task's `Name`, `Description`, and `Config`
   * @type module:Service.ITask.TaskInfo
   * @member module:Service.ITask.info
   */
  static get info(){
    return {
      Name: this.Name,
      Description: this.Description
    }
  }
}