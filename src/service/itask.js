const debug = require('debug')('dataparty.service.ITask')
const tasker = require('@dataparty/tasker')


module.exports = class ITask extends tasker.Task {

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
  constructor(options){
    super(options)
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

  /**
   * @typedef {Object} module:Service.ITask.TaskConfig
   * @property {boolean} background   Set to true if this is a background task
   * @property {boolean} autostart    Set to true if this task should be run at service start time
   */

  /**
   * @type module:Service.ITask.TaskConfig
   * @member module:Service.ITask.Config
   */
  static get Config(){
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