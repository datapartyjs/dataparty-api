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

  start () {
    //read and merge defaults
    return this
  }

  clear () {
    this.content = {}
  }

  readAll(){

    return Object.assign({}, this.content)
  }

  read(key){
    logger('reading path: ' + key)
    return reach( this.readAll(), key)
  }

  async write(key, value){

    let data = this.readAll()

    deepSet(data, key, value)

    this.content = Object.assign({}, data)

    return
  }


  exists(key){
    return (read(key) !== undefined)
  }

  async save(){
    return
  }
}

module.exports = MemoryConfig