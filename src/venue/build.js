const Path = require('path')
const debug = require('debug')('build')

 
const Dataparty = require('../index.js')

const Pkg = require('../../package.json')
const VenueService = require('./venue-service')


async function main(){
  const service = new VenueService({
    name: '@dataparty/venue',
    version: Pkg.version
  })

  const builder = new Dataparty.ServiceBuilder(service)
  const build = await builder.compile(Path.join(__dirname,'./dataparty'), true)

  debug('compiled')
}

main().catch(err=>{
  console.error('CRASH')
  console.error(err)
})