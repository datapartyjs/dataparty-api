'use strict';

const deepSet = require('lodash').set
const reach = require('../utils/reach')
const logger = require('debug')('dataparty.config.memory');

const IConfig = require('./iconfig')



/**
 * @class module:Config.MemoryConfig
 * @implements {module:IConfig}
 * @link module.Config
 */
class MemoryConfig extends IConfig {

  constructor(defaults){
    super()
    defaults = defaults || {}
    this.content = Object.assign({}, defaults)
  }

  async start () {
    //read and merge defaults
    return this
  }

  async clear () {
    this.content = {}
  }

  async readAll(){

    return Object.assign({}, this.content)
  }

  async read(key){
    logger('reading path: ' + key)
    return reach( await this.readAll(), key)
  }

  async write(key, value){

    let data = await this.readAll()

    deepSet(data, key, value)

    this.content = Object.assign({}, data)

    return
  }


  async exists(key){
    return (await read(key)) !== undefined
  }

  async save(){
    return
  }
}

module.exports = MemoryConfig