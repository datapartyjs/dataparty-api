'use strict';

const fs = require('fs')
const deepSet = require('deep-set')
const reach = require('../utils/reach')
const logger = require('debug')('dataparty.config.json-file');

/**
 * @class
 * @implements {Config}
 */
class JsonFileConfig {

  constructor(defaults={}){
    this.path = reach(defaults, 'basePath') +'/config.json'
    this.defaults = defaults || {}
    this.content = Object.assign({}, this.defaults)
  }

  async load(){
    logger('check exists', this.path)
    if(fs.existsSync(this.path)){
      
      logger('does exist ... reading')
      
      let rawdata = fs.readFileSync(this.path, {encoding: 'utf8'})
  
      logger('read raw data')
  
      if(rawdata ){
        logger('reading content')
        this.content = JSON.parse(rawdata)
      }

    }
    else{
      logger('does not exist')
      await this.save()
    }
  }

  async start () {
    await this.load()
    logger('started')
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