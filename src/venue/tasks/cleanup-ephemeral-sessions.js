const debug = require('debug')('dataparty.task.cleanup-ephemeral-sessions')

//const ITask = require('@dataparty/api/src/service/itask')
const ITask = require('../../service/itask')

class CleanupEphemeralSessionsTask extends ITask {

  constructor(options){
    super({
      name: CleanupEphemeralSessionsTask.name,
      background: CleanupEphemeralSessionsTask.Config.background,
      ...options
    })

    debug('new')

    this.duration = Math.round(1000*60*15)
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


  async lookupSessions(){

    let now = Date.now()

    return (await this.context.party.find()
      .type('session_key')
      .where('expiry').lt(now)
      .exec()) 
  }

  setTimer(){
    this.timeout = setTimeout(this.onTimeout.bind(this), this.duration)
  }
 
  async onTimeout(){
    this.timeout = null
    
    debug('cleanup ephemeral sessions task')

    try{
      let sessions = await this.lookupSessions()

      if(sessions && sessions.length > 0){
        debug('expired sessions ', sessions.length)
        let list = sessions.map(i=>{return i.data})
        await this.context.party.remove(...list)
      }
    } catch (err){
      debug(err)
    }

    this.setTimer()
  }
 
  stop(){
    if(this.timeout !== null){
      clearTimeout(this.timeout)
      this.timeout = null
    }
  }

  static get Name(){
    return 'cleanup-ephemeral-sessions'
  }

  static get Description(){
    return 'Cleanup Ephemeral sessions'
  }
}

module.exports = CleanupEphemeralSessionsTask