const Path = require('path')
const debug = require('debug')('test.service-compile')
const Dataparty = require('../src')

const {VM, NodeVM, VMScript} = require('vm2')

class ExampleService extends Dataparty.IService {
    constructor(opts){
      super(opts)

      this.addMiddleware(Dataparty.middleware_paths.pre.decrypt)
    }

}

class CodeAccessor {
  constructor(code){
    debug('code-accessor', code)
    this.script = new VMScript(code)
    debug('compiled')  
  }

  run(context, sandbox){
    debug('run')


    let vm = new NodeVM({
      sandbox,
      require: {
        external: {
          modules: ['debug', '@dataparty/crypto', '@hapi/joi', '@hapi/hoek']
        },
        //builtin: ['*']
      }
    })

    debug('has run')
    let fn = vm.run(this.script)
    const retVal = fn(context)
    debug('retVal', retVal)
    debug('context', context)
    return retVal
  }

}

class MiddlewareInfoAccessor extends CodeAccessor {
  constructor(code){
    super(`
      
      let lib = ${code}
     
      module.exports = ()=>{

      return {
        Name: lib.Name,
        Type: lib.Type,
        Description: lib.Description,
        ConfigSchema: lib.ConfigSchema
      }
    }
    `)
  }

}

async function main(){

  console.log(Object.keys(Dataparty))

  const service = new ExampleService({ name: '@dataparty/example', version: '0.0.1' })

  const build = await service.compile(Path.join(__dirname,'../dataparty'), false)

  //debug(build.middleware.pre.decrypt)

  let accessor = new MiddlewareInfoAccessor(build.middleware.pre.decrypt.code)

  console.log(accessor.run('derp'))

  console.log(build)
  
  process.exit()
}


main().catch(err=>{
  console.error(err)
})