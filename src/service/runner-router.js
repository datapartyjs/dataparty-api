const Debug = require('debug')
const debug = Debug('dataparty.service.runner-router')

class RunnerRouter {
  constructor(defaultRunner){
    debug('constructor')
    this.defaultRunner = defaultRunner

    debug('default runner - ', this.defaultRunner.party.identity)    

    this.runnersByDomain = new Map()
    this.runnersByHost = new Map()

    this.started = false
  }

  async start(){

    if(this.started){ return }

    debug('start')

    this.started = true

    for(let runner of this.runnersByHost){
      await runner.start()
    }
  }

  getRunnerByDomain(domain){
    debug('getRunnerByDomain -', domain)
    const runner = this.runnersByDomain.get(domain)
    if(!runner){
      return this.defaultRunner
    }
  }

  getRunnerByHostIdentity(identity){
    const partyId = identity.toString()
    debug('getRunnerByHostIdentity -', partyId)
    const runner = this.runnersByHost.get(partyId)
    
    return runner
  }

  addRunner({domain, runner}){

    const partyId = runner.party.identity.toString()
    debug('addRunner - ', partyId, domain)

    if(!this.runnersByHost.has(party)){
      this.runnersByHost.set(partyId, runner)
    }

    
    if(domain && !this.runnersByDomain.has(party)){
      this.runnersByDomain.set(domain, runner)
    }
  }


  onRequest(req, res){
    const runner = this.getRunnerByDomain(req.hostname)

    return runner.onRequest.bind(runner)(req,res)
  }
}

module.exports = RunnerRouter