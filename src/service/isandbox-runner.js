const Hoek = require('@hapi/hoek')
const debug = require('debug')('dataparty.ISandboxRunner')

class ISandboxRunner {

  /**
   * @class module:Service.ISandboxRunner
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
   * @member module:Service.ISandboxRunner.start
   */
  get info(){
    return Hoek.reach(this.sandboxes, 'info.info')
  }

  /**
   * @async
   * @method module:Service.ISandboxRunner.getInfo
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
   * @method module:Service.ISandboxRunner.start
   * @param {*} serviceContext 
   * @returns 
   */
  async start(serviceContext){
    debug('start')
    return await this.sandboxes.start.run(serviceContext)
  }

  /**
   * @async
   * @method module:Service.ISandboxRunner.run
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
   * @method module:Service.ISandboxRunner.self
   * 
   * @returns module:Serivce.ISandboxRunner
   */
  self(){
    return this
  }
}

module.exports = ISandboxRunner