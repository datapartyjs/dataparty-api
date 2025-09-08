const debug = require('debug')('dataparty.service.IAuth')

module.exports = class IAuth {

  /**
   * Interface class for Authorization
   * 
   * @interface module:Service.IAuth
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

  async lookupIdentity(identity){
    return identity
  }

  async isSocketConnectionAllowed(identity){
    //throw new Error('not implemented')
    return true
  }

  async isInternal(identity){
    return false
  }

  async isAdmin(identity){
    return false
  }

  async canReadDb(identity){
    return false
  }

  async canWriteDb(identity){
    return false
  }

  async canAccessTopics(identity){
    return true
  }

  /**
   * @typedef {Object} module:Service.IAuth.Info
   * @property {string} Name
   * @property {string} Description
   * @property {module:Service.IAuth.TaskConfig} Config
   */

  /**
   * Returns the task's `Name`, `Description`, and `Config`
   * @type module:Service.IAuth.Info
   * @member module:Service.IAuth.info
   */
  static get info(){
    return {
      Name: this.Name,
      Description: this.Description
    }
  }
}