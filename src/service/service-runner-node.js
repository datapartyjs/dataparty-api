const Path = require('path')
const Joi = require('joi')
const Hoek = require('@hapi/hoek')
const Debug = require('debug')
const debug = Debug('dataparty.service.runner-node')
const EndpointContext = require('./endpoint-context')
const DeltaTime = require('../utils/delta-time')

const Router = require('origin-router').Router
const Runner = require('@dataparty/tasker').Runner

class ServiceRunnerNode {

  /**
   * Unsafe service runner. This service runner uses `eval` to run services, endpoints and tasks.
   * This provides only simple context seperation and does not do effective context isolation.
   * This should only be used where the service is knwon trustworthy. When the `useNative` option 
   * is set to true the service will run in the same context as this class with no isolation at all.
   * @class module:Service.ServiceRunnerNode
   * @link module:Service
   * @param {module:Service.IService} options.service         The service to load endpoints from
   * @param {module:Party.IParty} options.party           The party to pass to the endpoints
   * @param {boolean} options.sendFullErrors  If true send full stack traces to clients. Defaults to false
   * @param {string} options.prefix          A prefix to apply to all endpoint paths
   * @param {Router} options.router          Router, defaults to `origin-router`
   * @param {boolean} options.useNative
   */
  constructor({service, party, sendFullErrors=false, useNative=true, prefix='', router=new Router()}){
    this.party = party
    this.service = service
    this.sendFullErrors = sendFullErrors
    this.useNative = useNative

    this.middleware = { pre: {}, post: {} }
    this.endpoint = {}
    this.tasks = {}
    this.topics = {}
    this.auth = null

    this.prefix=prefix
    this.router = router
    this.topicsRouter = new Router()
    this.taskRunner = new Runner()

    this.started = false

    this.taskCounter = 0
  }

  async start(){

    if(this.started){return}
    debug('starting tasks')

    this.started = true

    debug('loading auth')
    await this.loadAuth()

    const taskMap = Hoek.reach(this.service, 'compiled.tasks')
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
      debug('\t', Path.join('/venue/api', this.prefix, name))
    }

    debug('starting topics')

    const topicMap = Hoek.reach(this.service, 'compiled.topics')
    for(let name in topicMap){
      debug('\t',name)
      await this.loadTopic(name)
    }
  }


  async loadAuth(){
    if(this.auth){ return }

    let name = 'auth'
    debug('loadAuth', name, 'useNative =',this.useNative)

    let dt = new DeltaTime().start()
    

    "use strict"
    let authInstance=null

    let AuthClass = null

    if(!this.useNative){
      var self={}
      const build = Hoek.reach(this.service, `compiled.auth`)
      eval(build.code/*, build.map*/)
      AuthClass = self.Lib
    }
    else{
      AuthClass = this.service.constructors.auth
    }

    authInstance = new AuthClass({
      context:{
        party: this.party,
        serviceRunner: this
      }
    })


    debug('auth info', AuthClass.Name, '-', AuthClass.Description)

    this.auth = authInstance


    dt.end()
    debug('loaded auth','in',dt.deltaMs,'ms')
  }



  assertTaskIsValid(name){
    if(!this.tasks[name]){
      throw new Error('invalid task ['+name+']')
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
      var self={}
      const build = Hoek.reach(this.service, `compiled.tasks.${name}`)
      eval(build.code/*, build.map*/)
      TaskClass = self.Lib
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

  async spawnTask(type, context){
    this.assertTaskIsValid(type)

    debug('spawnTask', type, 'useNative =',this.useNative)

    let dt = new DeltaTime().start()


    "use strict"
    let task=null

    let TaskClass = null

    if(!this.useNative){
      var self={}
      const build = Hoek.reach(this.service, `compiled.tasks.${type}`)
      eval(build.code/*, build.map*/)
      TaskClass = self.Lib
    }
    else{
      TaskClass = this.service.constructors.tasks[type]
    }

    task = new TaskClass({
      context:{
        party: this.party,
        serviceRunner: this,
        ...context
      }
    })

    task.name = task.name + '-' + this.taskCounter++


    debug('task info', TaskClass.info)

    this.taskRunner.addTask(task)


    dt.end()
    debug('spawned task',task.name,'in',dt.deltaMs,'ms')

    return task
  }

  /**
   * Add a named task to the run queue
   * @see https://github.com/datapartyjs/tasker
   * @param {string} name 
   */
  runTask(name){
    this.assertTaskIsValid(name)
    const task = this.tasks[name]

    this.taskRunner.addTask(task)
  }

  async loadTopic(name){
    if(this.topics[name]){
      return
    }

    debug('loadTopic', name, 'useNative =',this.useNative)
    let dt = new DeltaTime().start()
    
    //"use strict"
    let topic=null

    let TopicClass = null

    if(!this.useNative){
      var self={}
      const build = Hoek.reach(this.service, `compiled.topics.${name}`)
      eval(build.code, build.map)
      TopicClass = self.Lib
    }
    else{
      TopicClass = this.service.constructors.topics[name]
    }

    topic = new TopicClass({
      context:{
        party: this.party,
        serviceRunner: this
      }
    })


    debug('topic info', TopicClass.info)

    this.topics[name] = topic

    const routablePath = Path.join(this.prefix, Path.normalize(name))

    let route = this.topicsRouter.add(name, routablePath/*, this.topicHandler(topic)*/)

    route.data = topic

    dt.end()
    debug('loaded topic',name,'in',dt.deltaMs,'ms')
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
      //debug('build', build.code)
      var self={}
      eval(build.code, build.map)
      endpoint = self.Lib
      //debug('obj Lib', self)
    }
    else{
      endpoint = this.service.constructors.endpoints[name]
    }

    debug('endpoint', endpoint)

    debug('endpoint info', endpoint.info)

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
        let self={}
        eval(build.code, build.map)
        middle = self.Lib
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

  /**
   * Expressjs style way of calling an endpoint. The req will be passed to the router to select the appropritate endpoint
   * @method module:Service.ServiceRunnerNode.onRequest
   * @param {Express.Request} req 
   * @param {Express.Response} res 
   * @returns 
   */
  async onRequest(req, res, next){
    debug('onRequest')

    debug('req', req.method, req.hostname,'-', req.url, req.ips, req.body)


    let route = await this.router.route(req, res)

    debug('req done - is null', route == null)


    if(!route){
      //res.status(404).end()
      return next()
    }
  }

  async getTopic(path){
    debug('looking up route', path)

    let p = new Promise(async (resolve,reject)=>{

      let route = await this.topicsRouter.route(path, (event)=>{

        //debug(event)
        //debug('topic route callback')


        if(!event.route){
          debug('no such topic', path)
          //reject('no such topic')
          resolve(null)
        } else {
          debug('found route', event.route.name)
        }

        return resolve({ route: event.route, topic: event.route.data, arguments: event.arguments })

      })

    })

    return await p
  }

  /*topicHandler(topic){
    return async (event)=>{
      debug(event)
      debug('topic handler')

      return "123"
    }
  }*/

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
