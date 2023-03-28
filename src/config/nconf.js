'use strict';

const fs = require('fs')
const os = require('os')
const Path = require('path')
const nconf = require('nconf')
const touch = require('touch')
const mkdirp = require('mkdirp')
const sanitize = require('sanitize-filename')

const logger = require('debug')('dataparty.config.nconf')

const IConfig = require('./iconfig')

var BASE_PATH = process.env.SNAP_COMMON || ((process.env.HOME) ? (process.env.HOME + '/.dataparty-api') : '.' )


/**
 * @class module:Config.NconfConfig
 * @implements {module:Config.IConfig}
 * @link {module.Config}
 */
class NconfConfig extends IConfig {

  constructor(defaults, whitelist){
    super()
    this.whitelist = whitelist || []
    this.basePath = defaults.basePath || BASE_PATH
    this.defaults = defaults || {}
    this.defaults.logicalSeparator = '.'
    this.started=false
  }

  start () {
    if(this.started){ return Promise.resolve(this) }

    this.touchDir('')
    let file_name = 'config.json'
    nconf.argv()
    const config_file = nconf.get('config')
    if (config_file){
      const file_path = Path.parse(config_file)
      file_name = file_path.base
      if (!Path.isAbsolute(config_file)){
        this.basePath = process.cwd() + '/' + file_path.dir
      } else {
        this.basePath = file_path.dir
      }
    }
    nconf.file({
      file: file_name,
      dir: this.basePath,
      search: true,
      logicalSeparator: '.', 
    })
    nconf.env({
      logicalSeparator: '.', 
      whitelist: this.whitelist,
    })

    nconf.defaults(this.defaults)

    nconf.load()
    logger(`config ready: ${this.basePath}/${file_name}`)
    this.started = true
    return Promise.resolve(this)
  }

  clear () {
    logger('clear')
    return Promise((resolve,reject)=>{
      logger('clearing')
      nconf.set(null, {})

      nconf.save((err)=>{
        if(err){ return reject(err) }

        return resolve()
      })
    })
  }

  readAll(){
    logger('read all')
    return nconf.get();
  }

  read(key){
    logger('reading key: ' + key)
    let val = nconf.get(key)

    return val
  }

  async write(key, data){
    return new Promise((resolve,reject)=>{
      logger('write key: ' + key)
      if(!nconf.set(key, data)){
        return reject()
      }

      resolve(this.save())
    })
  }


  exists(key){
    return (read(key) !== undefined)
  }

  async save(){
    logger('saving')
    return new Promise((resolve,reject)=>{
      nconf.save((err)=>{
        if(err){logger(err); return reject(err)}

        logger('saved')
        resolve()
      })
    })
  }

  fileExists(path){
    var realPath = this.basePath+"/" + Path.dirname(path) + "/" + sanitize(Path.basename(path))

    return fs.existsSync(realPath)
  }

  filePath(path){
    return this.basePath+"/" + Path.dirname(path) + '/'+ sanitize(Path.basename(path))
  }

  /*
  * @returns Promise(data)
  */
  async readFile(path){
    return new Promise((resolve,reject)=>{

      const realPath = this.basePath+"/" + Path.dirname(path) + "/" + sanitize(Path.basename(path))

      logger("Reading from file: " + realPath)
      fs.readFile(realPath, 'utf8', (err,data)=>{
        if(err){
          return reject(err)
        }

        resolve(data)
      })

    })
}

async linkFiles(existingPath, newPath){
  return new Promise((resolve, reject) => {
    const basedNewPath = Path.join(this.basePath, newPath)
    const basedExistingPath = Path.join(this.basePath, existingPath)

    logger(`linking '${basedExistingPath} -> ${basedNewPath}'`)
    fs.symlink(basedExistingPath, basedNewPath, (error) => {
      if (error) {
        logger(`failed to link '${basedExistingPath} -> ${basedNewPath}':`, error)
        return reject(error)
      }

      logger(`linked '${basedExistingPath} -> ${basedNewPath}'`)
      // resolve to adjusted path on success
      resolve(basedNewPath)
    })
  })
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

module.exports = NconfConfig