const Path = require('path')
const debug = require('debug')('test.server-db')
const Dataparty = require('../src')

/*class ExampleService extends Dataparty.IService {
    constructor(opts){
      super(opts)

      this.addMiddleware(Dataparty.middleware_paths.pre.decrypt)
    }

}*/

async function main(){

  console.log(Object.keys(Dataparty))

  const host = new Dataparty.ServiceHost()

  await host.start()

  console.log('started')
  
  //process.exit()
}



main().catch(err=>{
  console.error(err)
})