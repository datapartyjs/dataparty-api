const Debug = require('debug')
const debug = Debug('dataparty.service.runner-router')

class RunnerRouter {

  /**
   * A multi-domain drop in replacement for anywhere we use `origin-router.Router`.
   * By creating multiple dataparty `ServiceRunner`s you can manage multiple parties
   * and multiple services and merge them into either a single combined service. Or
   * host them as multiple seperate domains. Essentially, this allows the `ServiceHost`
   * to be multi-tenant.
   * 
   * @class module:Service.RunnerRouter
   * @link module:Service
   * @param {module:Service.ServiceRunner} defaultRunner The default runner to use if no others match. **Required**
   */
  constructor(defaultRunner){
    debug('constructor')
    this.defaultRunner = defaultRunner

    debug('default runner - ', this.defaultRunner.party.identity)    

    this.runnersByDomain = new Map()
    this.runnersByHost = new Map()

    this.started = false

  }
  
  /**
   * @async
   * @method module:Service.RunnerRouter.start
   * @returns 
   */
  async start(){
    
    if(this.started){ return }
    
    debug('start')
    
    this.started = true
    
    this.addRunner({runner: this.defaultRunner})

    for(let runner of this.runnersByHost){
      await runner[1].start()
    }
  }

  /**
   * @method module:Service.RunnerRouter.getRunnerByDomain
   * @param {string} domain 
   * @returns {module:Service.ServiceRunner}
   */
  getRunnerByDomain(domain){
    debug('getRunnerByDomain -', domain)
    const runner = this.runnersByDomain.get(domain)
    if(!runner){
      return this.defaultRunner
    }
  }

  /**
   * @method module:Service.RunnerRouter.getRunnerByHostIdentity
   * @param {dataparty_crypto.Identity} identity 
   * @returns {module:Service.ServiceRunner}
   */
  getRunnerByHostIdentity(identity){
    const partyId = identity.toString()
    debug('getRunnerByHostIdentity -', partyId)
    const runner = this.runnersByHost.get(partyId)
    
    return runner
  }

  /**
   * @method module:Service.RunnerRouter.addRunner
   * @param {string} options.domain
   * @param {module:Service.ServiceRunner} options.runner
   */
  addRunner({domain, runner}){

    const partyId = runner.party.identity.toString()
    debug('addRunner - ', partyId, domain)

    if(!this.runnersByHost.has(partyId)){
      this.runnersByHost.set(partyId, runner)
    }

    
    if(domain && !this.runnersByDomain.has(domain)){
      this.runnersByDomain.set(domain, runner)
    }
  }

/**
   * Expressjs style way of calling an endpoint. The req will be passed to the router to select the appropritate endpoint
   * @method module:Service.RouterRunner.onRequest
   * @param {Express.Request} req 
   * @param {Express.Response} res 
   * @returns 
   */
  onRequest(req, res, next){
    const runner = this.getRunnerByDomain(req.hostname)

    return runner.onRequest.bind(runner)(req,res, next)
  }
}

module.exports = RunnerRouter