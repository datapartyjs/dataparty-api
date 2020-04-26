'use strict';

const deepSet = require('deep-set')
const reach = require('../utils/reach')
const logger = require('debug')('dataparty.config.memory');

/**
 * @class
 * @implements {Config}
 */
class MemoryConfig {

  constructor(defaults){
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