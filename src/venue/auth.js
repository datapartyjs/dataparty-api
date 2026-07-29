const debug = require('debug')('dataparty.auth.venue-auth')

const IAuth = require('../service/iauth')
const {Identity} = require('@dataparty/crypto')


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

    let sessionKeyDoc = (await this.context.party.find()
      .type('session_key')
      .where('annoucement.sessionKey.hash')
      .equals(identity.key.hash)
      .exec()
    )[0]

    if(sessionKeyDoc){
      const actorIdentity = Identity.fromJSON({
        id: 'actor',
        key: sessionKeyDoc.data.annoucement.actorKey
      })

      return actorIdentity
    }

    return identity
  }

  async isSocketConnectionAllowed(identity){
    return await this.isAdmin(identity)
  }

  async isInternal(identity){
    return false
  }

  async isAdmin(identity){

    // verify key-hash is an admin
    const admins = (await this.context.party.config.read('admins')) || []

    if(admins.indexOf(identity.key.hash) == -1){
      debug('non-admin user', identity.key.hash)
      return false
    }

    return true
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