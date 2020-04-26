'use strict'

const reach = require('../../utils/reach')
const debug = require('debug')('dataparty.cloud.document')
const IDocument = require('../idocument')

/**
 * Represents a cached document with cloud change notifications
 * @class
 * @interface
 * @alias module:dataparty.DataParty.CloudDocument
 * @param {object}    options
 * @param {DataParty} options.party
 * @param {string}    options.id
 * @param {string}    options.type
 * @param {object}    options.data
 * @param {boolean}   options.followcache
 */
class CloudDocument extends IDocument {
  constructor({party, type, id, data, followcache}){
    super()
  }


  /**
   * Get this document's Acl
   * @method
   * @returns {Acl}
   */
  async acl(){
    if (this.type == 'acl'){
      return this
    }

    const aclDocumentList = await this.party.find()
      .type('acl')
      .where('resource.id').equals(this.id)
      .where('resource.type').equals(this.type)
      .exec()

    if(aclDocumentList.length > 0) {
      debug('found ACL for document -', this.idString)
      return aclDocumentList[0]
    }

    debug('creating acl')

    const rawAcl = (await this.party.create('acl', {
      resource: {
        id: this.id,
        type: this.type
      }
    }))[0]

    debug('created acl', rawAcl)

    const aclDoc = (await this.party.find()
      .type(reach(rawAcl, '$meta.type') || rawAcl.type)
      .id(reach(rawAcl, '$meta.id') || rawAcl.id)
      .exec())[0]

    debug('created ACL for document -', this.idString, aclDoc.data)

    return aclDoc
  }

  /**
   * Allow access to this document or a subfield
   * @methed
   * @param {string}  action  CRUFL operation
   * @param {IdObj}   actor   Actor object
   * @param {string}  field   Document subfield
   * @param {string}  allowed Allow/deny named `actor` access
   */
  async grantAccess(action, actor, field = '', allowed = true) {
    const aclDocument = await this.acl()
    debug('granting access to document -', this.idString, 'via acl - ', aclDocument.data)
    return aclDocument.setPermissionsByField(action, actor, field, allowed)
  }

  /**
   * CloudDocument owner as an IdObj
   * @type {IdObj}  
   */
  get owner(){
    return {
      id: reach(this.data, 'owner.id'),
      type: reach(this.data, 'owner.type')
    }
  }

  
}

module.exports = CloudDocument
