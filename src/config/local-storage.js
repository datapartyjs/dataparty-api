'use strict';

const deepSet = require('lodash').set
const reach = require('../utils/reach')
const logger = require('debug')('dataparty.config.local-storage');

const IConfig = require('./iconfig')


/**
 * @class  module:Config.LocalStorageConfig
 * @implements {module:Config.IConfig}
 * @link module.Config
 */
class LocalStorageConfig extends IConfig {

  constructor(defaults, whitelist){
    super()
    this.whitelist = whitelist || []
    defaults = defaults || {}
    this.basePath = defaults.basePath || 'dataparty-api'
    this.defaults = defaults || {}
    this.defaults.logicalSeparator = '.'
  }

  async start () {
    return this
  }

  async clear () {
    localStorage.setItem(this.basePath, JSON.stringify({}))
  }

  async readAll(){
    try{
      return Object.assign(
        {},
        this.defaults,
        JSON.parse( localStorage.getItem(this.basePath) || '{}' )
      )
    }
    catch(err){
      return {}
    }
  }

  async read(key){
    logger('reading path: ' + key)
    return reach( await this.readAll(), key)
  }

  async write(key, value){

    let data = await this.readAll()

    deepSet(data, key, value)

    localStorage.setItem(this.basePath, JSON.stringify(data))

    return
  }


  async exists(key){
    return (await read(key)) !== undefined
  }

  async save(){
    return
  }
}

module.exports = LocalStorageConfig