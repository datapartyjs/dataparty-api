const debug = require('debug')('dataparty.task.status-update')

const ITask = require('../../src/service/itask')

class StatusDisplayTask extends ITask {

  constructor(options){
    super({
      name: StatusDisplayTask.name,
      background: StatusDisplayTask.Config.background,
      ...options
    })

    debug('new')

    this.duration = 5000
    this.timeout = null
  }

  static get Config(){
    return {
      background: true,
      autostart: true
    }
  }
 
  async exec(){

    this.setTimer()

    return this.detach()
  }

  setTimer(){
    this.timeout = setTimeout(this.onTimeout.bind(this), this.duration)
  }
 
  onTimeout(){
    this.timeout = null
    
    this.context.serviceRunner.taskRunner.printTaskLists()
    debug('sleep complete')

    this.setTimer()
  }
 
  stop(){
    if(this.timeout !== null){
      clearTimeout(this.timeout)
      this.timeout = null
    }
  }

  static get Name(){
    return 'status-display'
  }

  static get Description(){
    return 'Status Display'
  }
}

module.exports = StatusDisplayTask