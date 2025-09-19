const debug = require('debug')('dataparty.auth.venue-auth')

const IAuth = require('../service/iauth')


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
    return 'auth'
    //throw new Error('not implemented')
  }

  /**
   * @type {string}
   * @member module:Service.ITask.Description
   */
  static get Description(){
    return 'venue auth'
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
}