const Path = require('path')
const debug = require('debug')('example.build')

const Pkg = require('../../package.json')
const ExampleService = require('./example-service')

async function main(){
  const service = new ExampleService({ name: Pkg.name, version: Pkg.version })


  const build = await service.compile(Path.join(__dirname,'../dataparty'), true)

  debug('compiled')
}

main().catch(err=>{
  console.error('CRASH')
  console.error(err)
})