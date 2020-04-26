'use strict'

const reach = require('../../utils/reach')
const debug = require('debug')('dataparty.local.document')
const IDocument = require('../idocument')

/**
 * Represents a basic document
 * @class
 * @interface
 * @alias module:dataparty.DataParty.LocalDocument
 * @param {object}    options
 * @param {DataParty} options.party
 * @param {string}    options.id
 * @param {string}    options.type
 * @param {object}    options.data
 * @param {boolean}   options.followcache
 */
class LocalDocument extends IDocument {
  constructor(options){
    super(options)
  }


  
}

module.exports = LocalDocument
