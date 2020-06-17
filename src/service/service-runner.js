const Joi = require('@hapi/joi')
const Hoek = require('@hapi/hoek')
const {VM, VMScript} = require('vm2')
const debug = require('debug')('dataparty.server-runner')
const MiddlewareRunner = require('./middleware-runner')
const EndpointContext = require('./endpoint-context')
const EndpointRunner = require('./endpoint-runner')

const Router = require('origin-router').Router

class ServiceRunner {
  constructor({service, party}){
    this.party = party
    this.service = service

    this.middleware = { pre: {}, post: {} }
    this.endpoint = {}

    this.router = new Router()
  }

  async start(){
    debug('starting endpoints')

    const eps = Hoek.reach(this.service, 'compiled.endpoints')
    const endpointsLoading = []
    for(let name in eps){
      debug('\t',name)
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
    let endpoint = new EndpointRunner(this.service.compiled.endpoints[name].code)

    debug('getting info')
    await endpoint.getInfo()

    debug('got info')

    await this.checkEndpointConfig(endpoint)

    await this.loadEndpointMiddleware(endpoint, 'pre')
    await this.loadEndpointMiddleware(endpoint, 'post')

    await endpoint.start(this.party)

    this.endpoint[name] = endpoint

    this.router.add(name, this.endpointHandler(endpoint))
  }

  endpointHandler(endpoint){
    return async (event)=>{

      debug('event',event)

      //const result = await endpoint.run(context)

      debug(Object.keys(event))

      const context = new EndpointContext({
        req: event.request, res: event.response,
        endpoint,
        party: this.party,
      })

      debug('running')
  
      const result = await endpoint.run(context)

      debug('result', result)

      context.res.send(result)

    }
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

    let middleware = new MiddlewareRunner(this.service.compiled.middlware[type][name].code)

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

    debug('req', Object.keys(req), req.body)

    debug('endpoints', Object.keys(this.endpoint))


    let route = await this.router.route(req, res)

    debug(route)

    if(!route){
      res.status(404).end()
      return
    }
  }
}

module.exports = ServiceRunner