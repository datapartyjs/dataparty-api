const Path = require('path')
const Joi = require('@hapi/joi')
const Hoek = require('@hapi/hoek')
const {VM, VMScript} = require('vm2')
const Debug = require('debug')
const debug = Debug('dataparty.service-runner')
const MiddlewareRunner = require('./middleware-runner')
const EndpointContext = require('./endpoint-context')
const EndpointRunner = require('./endpoint-runner')

const Router = require('origin-router').Router

class ServiceRunner {
  constructor({service, party, sendFullErrors=false}){
    this.party = party
    this.service = service
    this.sendFullErrors = sendFullErrors

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
    debug('endpoints ready:')
    for(let name in this.endpoint){
      debug('\t', Path.join('/', name))
    }
  }

  async loadEndpoint(name){
    if(this.endpoint[name]){
      return
    }

    debug('loadEndpoint', name)
    const build = Hoek.reach(this.service, `compiled.endpoints.${name}`)
    let endpoint = new EndpointRunner(build.code, build.map)

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


  async loadEndpointMiddleware(endpoint, type='pre'){
    const middlewareList = Hoek.reach(endpoint, `info.MiddlewareConfig.${type}`)
    for(let name in middlewareList){
      const middleware = await this.loadMiddleware(name, type, endpoint)

      const middlewareCfg = Hoek.reach(endpoint, `info.MiddlewareConfig.${type}.${name}`)
      await this.checkMiddlewareConfig(middleware, middlewareCfg)
    }


  }

  async loadMiddleware(name, type='pre'){ 
    if(this.middleware[type][name]){
      return this.middleware[type][name]
    }

    debug('loadMiddleware', type, name)

    const build = Hoek.reach(this.service, `compiled.middleware.${type}.${name}`)

    if(!build || !build.code){
      debug(`middleware ${type} [${name}] does not exist`)
      throw new Error(`middleware ${type} [${name}] does not exist`)
    }

    let runner = new MiddlewareRunner(build.code, build.map)

    await runner.getInfo()
    await runner.start(this.party)

    this.middleware[type][name] = runner

    return runner
  }

  async checkEndpointConfig(endpoint){
    //! check basic structure {pre: Object, post: Object}
    
    return await Joi.object().keys({
      pre: Joi.object().keys(null),
      post: Joi.object().keys(null)
    })
    .validateAsync(endpoint.info.MiddlewareConfig)
  }

  async checkMiddlewareConfig(middleware, middlewareCfg){
    //! check endpoint configures middleware correctly

    return await middleware.info.ConfigSchema.validateAsync(middlewareCfg)
  }

  async onRequest(req, res){
    debug('onRequest')

    debug('req', req.method, req.url, req.body)



    let route = await this.router.route(req, res)


    if(!route){
      res.status(404).end()
      return
    }
  }


  endpointHandler(endpoint){
    return async (event)=>{

      debug('event',event.method, event.pathname)


      const context = new EndpointContext({
        req: event.request, res: event.response,
        endpoint,
        party: this.party,
        input: event.request.body, 
        debug: Debug,
        sendFullErrors: this.sendFullErrors
      })

      debug('running', endpoint.info.Name)

      const middlewareCfg = Hoek.reach(endpoint, 'info.MiddlewareConfig')
      
      try{

        await this.runMiddleware(middlewareCfg, context, 'pre')
    
        const result = await endpoint.run(context)

        context.setOutput(result)

        await this.runMiddleware(middlewareCfg, context, 'post')

        /*debug('ctx.log', context._debugContent)*/
        debug('result', context.output)

        context.res.send(context.output)

      }
      catch(err){
        debug('caught error', err)

        context.res.status(500).send({
          error: {
            code: err.code,
            message: err.message,
            stack: (!context.sendFullErrors ? undefined : err.stack),
            ... (!context.sendFullErrors ? null : err)
          }
        })
      }

    }
  }

  async runMiddleware(middlewareCfg, ctx, type='pre'){
    debug(`run ${type} middleware`)

    const cfg = Hoek.reach(middlewareCfg, type)
    const order = Hoek.reach(this.service, 'compiled.middleware_order.'+type)

    debug('\tmiddleware order', order)

    for(let name of order){
      const info = Hoek.reach(cfg, name)

      if(!info){ continue }

      debug('\t\trunning', name)
      const middleware = Hoek.reach(this.middleware, `${type}.${name}`)

      await middleware.run(ctx, info)
    }
  }
}

module.exports = ServiceRunner