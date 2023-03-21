'use strict';

const fs = require('fs')
const Path = require('path')
const mkdirp = require('mkdirp')
const deepSet = require('deep-set')
const reach = require('../utils/reach')
const logger = require('debug')('dataparty.config.json-file');

/**
 * @class
 * @implements {Config}
 */
class JsonFileConfig {

  constructor(defaults={}){
    this.basePath = reach(defaults, 'basePath')
    this.path = this.basePath +'/config.json'
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
    await this.touchDir('')
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

  async touchDir (path) {
    return new Promise((resolve, reject) => {
      const basedPath = Path.join(this.basePath, path)
      logger('touching', basedPath)
      mkdirp(basedPath, (error) => {
        if (error) {
          logger(`failed to mkdirp '${basedPath}':`, error)
          return reject(error)
        }

        logger('touched', basedPath)
        // resolve to adjusted path on success
        resolve(basedPath)
      })
    })
  }
}

module.exports = JsonFileConfig