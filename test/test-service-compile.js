const Path = require('path')
const debug = require('debug')('test.service-compile')
const Dataparty = require('../src')

process.on('uncaughtException', (err) => {
  console.error('Asynchronous error caught.', err);
})

class ExampleService extends Dataparty.IService {
  constructor(opts){
    super(opts)

    this.addMiddleware(Dataparty.middleware_paths.pre.decrypt)
    this.addMiddleware(Dataparty.middleware_paths.pre.validate)

    this.addMiddleware(Dataparty.middleware_paths.post.validate)
    this.addMiddleware(Dataparty.middleware_paths.post.encrypt)

    this.addEndpoint(Dataparty.endpoint_paths.echo)
    //this.addEndpoint(Dataparty.endpoint_paths.identity)
    
  }

}


async function main(){

  debug(Object.keys(Dataparty))

  const service = new ExampleService({ name: '@dataparty/example', version: '0.0.1' })

  const build = await service.compile(Path.join(__dirname,'../dataparty'), true)

  let decryptInfo = new Dataparty.MiddlewareInfoSandbox(build.middleware.pre.decrypt.code)

  try{
    await decryptInfo.run()
  }
  catch(err){
    debug('supressing error')
    debug('\tname\t',err.name)
    debug('\tcode\t',err.code)

    debug('\tmsg\t',err.message)

    debug('\tstack\t',err.stack)

    debug('\tlocations\t',err.locations)
  }

  debug('# Middleware #')
  debug('\t Name=', decryptInfo.info.Name)
  debug('\t Type="', decryptInfo.info.Type, '"')
  debug('\t Desc="', decryptInfo.info.Description, '"')
  
  process.exit()
}


main().catch(err=>{
  console.error(err)
})