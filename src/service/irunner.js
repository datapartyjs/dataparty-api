const Hoek = require('@hapi/hoek')
const debug = require('debug')('dataparty.irunner')

class IRunner {

  /**
   * @class module:Service.IRunner
   * @link module:Service
   * @param {*} options.info
   * @param {*} options.exec
   * @param {*} options.start
   */

  constructor({info, exec, start}){
    this.sandboxes = {
      info, exec, start
    }
  }

  /**
   * @member module:Service.IRunner.start
   */
  get info(){
    return Hoek.reach(this.sandboxes, 'info.info')
  }

  /**
   * @async
   * @method module:Service.IRunner.getInfo
   * @returns 
   */
  async getInfo(){
    if(!this.sandboxes.info.info){
      await this.sandboxes.info.run()
    }

    return this.sandboxes.info.info
  }

  /**
   * @async
   * @method module:Service.IRunner.start
   * @param {*} serviceContext 
   * @returns 
   */
  async start(serviceContext){
    debug('start')
    return await this.sandboxes.start.run(serviceContext)
  }

  /**
   * @async
   * @method module:Service.IRunner.run
   * 
   * @param {*} context 
   * @param {*} static_ctx 
   * @returns 
   */
  async run(context, static_ctx){
    debug('run')
    return await this.sandboxes.exec.run(context, static_ctx)
  }

  /**
   * @async
   * @method module:Service.IRunner.self
   * 
   * @returns module:Serivce.IRunner
   */
  self(){
    return this
  }
}

module.exports = IRunner