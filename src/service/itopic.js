const debug = require('debug')('dataparty.service.IAcl')

module.exports = class ITopic {

  /**
   * Interface class for supporting `tasker` tasks in dataparty.
   * To add a task to dataparty service extend this class and implement
   * the `Name`, `Description` and `Config` members.
   * 
   * @interface module:Service.ITask
   * @link module:Service
   * @see https://github.com/datapartyjs/tasker
   * @extends {tasker.Task}
   * @param {Object} options Options to pass to `tasker.Task(options)`
   */
  constructor({context}){
    this.context = {
      party: context.party,
      serviceRunner: context.serviceRunner
    }
  }

  /**
   * @type {string}
   * @member module:Service.ITask.Name
   */
  static get Name(){
    throw new Error('not implemented')
  }

  /**
   * @type {string}
   * @member module:Service.ITask.Description
   */
  static get Description(){
    throw new Error('not implemented')
  }

  static async canAdvertise(party, ){
    throw new Error('not implemented')
  }

  static async canPublish(){
    throw new Error('not implemented')
  }

  static async canSubscribe(){
    throw new Error('not implemented')
  }

  /**
   * @typedef {Object} module:Service.ITask.TaskInfo
   * @property {string} Name
   * @property {string} Description
   * @property {module:Service.ITask.TaskConfig} Config
   */

  /**
   * Returns the task's `Name`, `Description`, and `Config`
   * @type module:Service.ITask.TaskInfo
   * @member module:Service.ITask.info
   */
  static get info(){
    return {
      Name: this.Name,
      Description: this.Description,
      Config: this.Config
    }
  }
}