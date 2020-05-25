const Path = require('path')
const debug = require('debug')('test.server-db')
const Dataparty = require('../src')

class ExampleService extends Dataparty.IService {
    constructor(opts){
      super(opts)

      this.addMiddleware(Dataparty.middleware_paths.pre.decrypt)
    }

}

async function main(){

  console.log(Object.keys(Dataparty))

  const service = new ExampleService({ name: '@dataparty/example', version: '0.0.1' })

  const build = await service.compile(Path.join(__dirname,'../dataparty'))

  console.log(build)
  
  process.exit()
}


main().catch(err=>{
  console.error(err)
})