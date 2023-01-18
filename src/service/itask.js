const debug = require('debug')('dataparty.service.ITask')
const tasker = require('@dataparty/tasker')


module.exports = class ITask extends tasker.Task {

  constructor(options){
    super(options)
  }

  static get Name(){
    throw new Error('not implemented')
  }

  static get Description(){
    throw new Error('not implemented')
  }

  static get Config(){
    throw new Error('not implemented')

    /**
     * 
     * return {
     *  background: true
     *  autostart: true
     * }
     */
  }

  static get info(){
    return {
      Name: this.Name,
      Description: this.Description,
      Config: this.Config
    }
  }
}