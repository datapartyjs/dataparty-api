const Hoek = require('@hapi/hoek')
const {VM, VMScript} = require('vm2')
const debug = require('debug')('dataparty.server-runner')

class Runner {
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
    return await this.sandboxes.start.run(serviceContext)
  }

  async run(context){
    return await this.sandboxes.exec.run(context)
  }
}

class MiddlewareRunner extends Runner {
  constructor(code){
    super({
      info: new MiddlewareInfoSandbox(code),
      exec: new MiddlewareExecSandbox(code),
      start: new MiddlewareExecSandbox(code,'start')
    })
  }
}

class EndpointRunner extends Runner {
  constructor(code){
    super({
      info: new EndpointInfoSandbox(code),
      exec: new MiddlewareExecSandbox(code),
      start: new MiddlewareExecSandbox(code,'start')
    })
  }
}



class ServiceRunner {
  constructor({service, party}){
    this.party = party
    this.service = service

    this.middleware = { pre: {}, post: {} }
    this.endpoint = {}
  }

  async start(){
    debug('starting')

    const eps = Hoek.reach(this.service, 'compiled.endpoints')
    const endpointsLoading = []
    for(let name in eps){
      endpointsLoading.push( this.loadEndpoint(name) )
    }

    await Promise.all(endpointsLoading)
    debug('ready')
  }

  async loadEndpoint(name){
    if(this.endpoint[name]){
      return
    }

    debug('loadEndpoint', name)
    let endpoint = new EndpointRunner(this.service.compiled.endpoints[name])

    await endpoint.getInfo()
    await this.checkEndpointConfig(endpoint)

    await loadEndpointMiddleware(endpoint)
    await loadEndpointMiddleware(endpoint, 'post')

    await endpoint.start(this.party)

    this.endpoint[name] = endpoint


  }

  async loadEndpointMiddleware(endpoint, type='pre'){
    const preOrder = Hoek.reach(this.service, 'compiled.middleware_order.'+type)
    for(let name in preOrder){
      const middlewareCfg = Hoek.reach(endpoint, 'info.MiddlewareConfig.'+type+'.'+name)
      
      if(!middlewareCfg){continue}

      const middleware = await loadMiddleware(name)
      await checkMiddlewareConfig(middleware, middlewareCfg)
    }
  }

  async loadMiddleware(name, type='pre'){ 
    if(this.middleware[type][name]){
      return this.middleware[type][name]
    }

    debug('loadMiddleware', type, name)

    let middleware = new MiddlewareRunner(this.service.compiled.middlware[type][name])

    await middleware.getInfo()
    await middleware.start(this.party)

    this.middleware[type][name] = middleware

    return middleware
  }

  async checkEndpointConfig(endpoint){
    //! check basic structure {pre: Object, post: Object}
    
    return await Joi.object().keys({
      pre: Joi.object(),
      post: Joi.object()
    })
    .validateAsync(endpoint.info.MiddlewareConfig)
  }

  async checkMiddlewareConfig(middleware, middlewareCfg){
    //! check endpoint configures middleware correctly

    return await middleware.info.ConfigSchema.validateAsync(middlewareCfg)
  }

  async onRequest(req, res){
    debug('onRequest')

    const context = new EndpointContext({
      req, res,
      party: this.party,
    })
  }
}

