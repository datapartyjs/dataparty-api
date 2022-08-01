'use strict';

const fs = require('fs')
const deepSet = require('deep-set')
const reach = require('../utils/reach')
const logger = require('debug')('dataparty.config.memory');

/**
 * @class
 * @implements {Config}
 */
class JsonFileConfig {

  constructor(defaults){
    this.path = reach(defaults, 'basePath') +'/config.json'
    this.defaults = defaults || {}
    this.content = Object.assign({}, this.defaults)
  }

  async load(){
    if(!fs.existsSync(this.path)){return}
    
    let rawdata = fs.readFileSync(this.path)

    if(rawdata && rawdata.length > 0){
      this.content = JSON.parse(rawdata)
    }
  }

  async start () {
    await this.load()
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
    return reach( this.content, key)
  }

  async write(key, value){

    deepSet(this.content, key, value)
    await this.save()
  }


  exists(key){
    return (read(key) !== undefined)
  }

  async save(){
    fs.writeFileSync(this.path, JSON.stringify(this.content, null, 2))
  }
}

module.exports = JsonFileConfig