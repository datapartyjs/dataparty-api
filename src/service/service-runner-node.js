const Path = require('path')
const Joi = require('@hapi/joi')
const Hoek = require('@hapi/hoek')
const Debug = require('debug')
const debug = Debug('dataparty.service.runner-node')
const EndpointContext = require('./endpoint-context')
const DeltaTime = require('../utils/delta-time')

const Router = require('origin-router').Router
const Runner = require('@dataparty/tasker').Runner

class ServiceRunnerNode {
  constructor({service, party, sendFullErrors=false, useNative=true}){
    this.party = party
    this.service = service
    this.sendFullErrors = sendFullErrors
    this.useNative = useNative

    this.middleware = { pre: {}, post: {} }
    this.endpoint = {}
    this.tasks = {}

    this.router = new Router()
    this.taskRunner = new Runner()
  }

  async start(){

    debug('starting tasks')

    const taskMap = Hoek.reach(this.service, 'compiled.tasks')
    //const endpointsLoading = []
    for(let name in taskMap){
      debug('\t',name)
      await this.loadTask(name)
    }

    debug('tasks ready:')
    for(let name in this.tasks){
      debug('\t', name)
    }

    await this.taskRunner.start()


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

  async loadTask(name){
    if(this.tasks[name]){
      return
    }

    debug('loadTask', name, 'useNative =',this.useNative)

    let dt = new DeltaTime().start()
    

    "use strict"
    let task=null

    let TaskClass = null

    if(!this.useNative){
      const build = Hoek.reach(this.service, `compiled.tasks.${name}`)
      TaskClass = eval(build.code/*, build.map*/)
    }
    else{
      TaskClass = this.service.constructors.tasks[name]
    }

    task = new TaskClass({
      context:{
        party: this.party,
        serviceRunner: this
      }
    })


    debug('task info', TaskClass.info)

    this.tasks[name] = task

    if(TaskClass.Config.autostart){
      this.taskRunner.addTask(task)
    }


    dt.end()
    debug('loaded task',name,'in',dt.deltaMs,'ms')
  }

  runTask(name){
    const task = this.tasks[name]

    this.taskRunner.addTask(task)
  }

  async loadEndpoint(name){
    if(this.endpoint[name]){
      return
    }

    debug('loadEndpoint', name, 'useNative =',this.useNative)

    let dt = new DeltaTime().start()
    

    "use strict"
    let endpoint=null

    if(!this.useNative){
      const build = Hoek.reach(this.service, `compiled.endpoints.${name}`)
      endpoint = eval(build.code/*, build.map*/)
    }
    else{
      endpoint = this.service.constructors.endpoints[name]
    }


    debug('endpoint info', endpoint.info)

    await this.checkEndpointConfig(endpoint)

    await this.loadEndpointMiddleware(endpoint, 'pre')
    await this.loadEndpointMiddleware(endpoint, 'post')

    await endpoint.start(this.party)

    this.endpoint[name] = endpoint

    this.router.add(name, name, this.endpointHandler(endpoint))
    dt.end()
    debug('loaded endpoint',name,'in',dt.deltaMs,'ms')
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
      //debug('cached',type,'middleware',name)
      return this.middleware[type][name]
    }

    debug('loadMiddleware', type, name, 'useNative =',this.useNative)

    let dt = new DeltaTime().start()
    const build = Hoek.reach(this.service, `compiled.middleware.${type}.${name}`)

    if(this.useNative && !this.service.constructors.middleware[type][name]){
      debug(`native middleware ${type} [${name}] does not exist`)
      throw new Error(`native middleware ${type} [${name}] does not exist`)
    }

    if(!this.useNative && (!build || !build.code) ){
      debug(`compiled middleware ${type} [${name}] does not exist`)
      throw new Error(`compiled middleware ${type} [${name}] does not exist`)
    }

    let ret = async ()=>{

      "use strict"
      let middle=null
  
      if(!this.useNative){
        middle = eval(build.code/*, build.map*/)
      }
      else{
        middle = this.service.constructors.middleware[type][name]
      }

      //debug('middleware info', middle.info)

      //await runner.getInfo()
      //await runner.start(this.party)
      await middle.start(this.party)

      this.middleware[type][name] = middle

      dt.end()
      debug('loaded',type,'middleware',name,'in',dt.deltaMs,'ms')

      return middle
    }

    return await ret()

    
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

    debug('req', req.method, req.hostname,'-', req.url, req.ips, req.body)



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
      let phase = 'pre-middleware'
      
      try{

        await this.runMiddleware(middlewareCfg, context, 'pre')
    
        phase = 'endpoint'
        const result = await endpoint.run(context, {Package: this.service.compiled.package})

        phase = 'output'
        context.setOutput(result)

        phase = 'post-middleware'
        await this.runMiddleware(middlewareCfg, context, 'post')
        phase = 'send'

        context.dt.end()

        /*debug('ctx.log', context._debugContent)*/
        debug('ran endpoint', endpoint.info.Name, 'in', context.dt.deltaMs, 'ms')
        debug('result', context.output)

        context.res.send(context.output)

      }
      catch(err){

        if(this.sendFullErrors){
          debug('caught error', err)
        }
        else{
          debug('caught error (', err.message, ')')
        }

        context.dt.end()

        debug('crashed (',endpoint.info.Name,') in', context.dt.deltaMs, 'ms')

        context.res.status(500).send({
          error: {
            code: err.code,
            message: err.message,
            phase,
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
      await middleware.run(ctx, {Config:info})
      dt.end()

      debug('runMiddleware(',type,name,') in', dt.deltaMs, 'ms')
    }
  }
}

module.exports = ServiceRunnerNode