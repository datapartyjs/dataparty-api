const Hoek = require('@hapi/hoek')
const debug = require('debug')('dataparty.irunner')

class IRunner {
  constructor({info, exec, start}){
    this.sandboxes = {
      info, exec, start
    }
  }

  get info(){
    return Hoek.reach(this.sandboxes, 'info.info')
  }

  async getInfo(){
    if(!this.sandboxes.info.info){
      await this.sandboxes.info.run()
    }

    return this.sandboxes.info.info
  }

  async start(serviceContext){
    debug('start')
    return await this.sandboxes.start.run(serviceContext)
  }

  async run(context, static_ctx){
    debug('run')
    return await this.sandboxes.exec.run(context, static_ctx)
  }

  self(){
    return this
  }
}

module.exports = IRunner