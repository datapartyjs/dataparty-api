const Path = require('path')
const Joi = require('joi')
const Hoek = require('@hapi/hoek')
const {VM, VMScript} = require('vm2')
const Debug = require('debug')
const debug = Debug('dataparty.service.runner')
const MiddlewareRunner = require('./middleware-runner')
const EndpointContext = require('./endpoint-context')
const EndpointRunner = require('./endpoint-runner')

const DeltaTime = require('../utils/delta-time')

const Router = require('origin-router').Router
const Runner = require('@dataparty/tasker').Runner

class ServiceRunner {


  /**
   * Sandboxed service runner. This runner uses the `vm2` package to run end points in a fully isolated context.
   * Endpoints, pre-middleware and post-middleware all run as independant precompiled `VMScript`s.
   * @class module:Service.ServiceRunner
   * @link module:Service
   * @param {module:Service.IService} options.service         The service to load endpoints from
   * @param {module:Party.IParty} options.party           The party to pass to the endpoints
   * @param {boolean} options.sendFullErrors  If true send full stack traces to clients. Defaults to false
   * @param {string} options.prefix          A prefix to apply to all endpoint paths
   * @param {Router} options.router          Router, defaults to `origin-router`
   */
  constructor({service, party, sendFullErrors=false, prefix='', router=new Router()}){
    this.party = party
    this.service = service
    this.sendFullErrors = sendFullErrors

    this.middleware = { pre: {}, post: {} }
    this.endpoint = {}
    this.tasks = {}

    this.prefix = prefix
    this.router = router
    this.taskRunner = new Runner()

    this.started = false
  }

  async start(){

    if(this.started){return}

    this.started = true
    debug('starting endpoints')

    const eps = Hoek.reach(this.service, 'compiled.endpoints')
    //const endpointsLoading = []
    for(let name in eps){
      debug('\t',name)
      await this.loadEndpoint(name)
      //endpointsLoading.push( this.loadEndpoint(name) )
    }

    //await Promise.all(endpointsLoading)
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

    let dt = new DeltaTime().start()
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

    const routablePath = Path.join(this.prefix, Path.normalize(name))

    this.router.add(name, routablePath, this.endpointHandler(endpoint))
    dt.end()
    debug('loaded endpoint', routablePath,'in',dt.deltaMs,'ms')
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
      debug('cached',type,'middleware',name)
      return this.middleware[type][name]
    }

    debug('loadMiddleware', type, name)

    let dt = new DeltaTime().start()
    const build = Hoek.reach(this.service, `compiled.middleware.${type}.${name}`)

    if(!build || !build.code){
      debug(`middleware ${type} [${name}] does not exist`)
      throw new Error(`middleware ${type} [${name}] does not exist`)
    }

    let runner = new MiddlewareRunner(build.code, build.map)

    await runner.getInfo()
    await runner.start(this.party)

    this.middleware[type][name] = runner

    dt.end()
    debug('loaded',type,'middleware',name,'in',dt.deltaMs,'ms')

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

  /**
   * Expressjs style way of calling an endpoint. The req will be passed to the router to select the appropritate endpoint
   * @method module:Service.ServiceRunner.onRequest
   * @param {Express.Request} req 
   * @param {Express.Response} res 
   * @returns 
   */
  async onRequest(req, res){
    debug('onRequest')

    debug('req', req.method, req.url, req.body)



    let route = await this.router.route(req, res)

    debug('req done')


    if(!route){
      res.status(404).end()
      return
    }
  }


  endpointHandler(endpoint){
    return async (event)=>{

      debug('event',event.method, event.pathname, event.request.ip, event.request.ips)


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
    
        const result = await endpoint.run(context, {Package: this.service.compiled.package})

        context.setOutput(result)

        await this.runMiddleware(middlewareCfg, context, 'post')

        context.dt.end()

        /*debug('ctx.log', context._debugContent)*/
        debug('ran endpoint', endpoint.info.Name, 'in', context.dt.deltaMs, 'ms')
        debug('result', context.output)

        context.res.send(context.output)

      }
      catch(err){
        debug('caught error', err)

        context.dt.end()

        debug('crashed (',endpoint.info.Name,') in', context.dt.deltaMs, 'ms')

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

      const dt = new DeltaTime().start()
      await middleware.run(ctx, {Config: info})
      dt.end()

      debug('runMiddleware(',type,name,') in', dt.deltaMs, 'ms')
    }
  }
}

module.exports = ServiceRunner