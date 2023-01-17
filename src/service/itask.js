const debug = require('debug')('dataparty.service.ITask')
const tasker = require('@dataparty/tasker')


module.exports = class ITask extends tasker.Task {

  static get Name(){
    throw new Error('not implemented')
  }

  static get Description(){
    throw new Error('not implemented')
  }

  static get info(){
    return {
      Name: this.Name,
      Description: this.Description
    }
  }
}