const DatapartySrv = require('../service')
const debug = require('debug')('venue.service')

const Path = require('path')

class VenueService extends DatapartySrv.IService {
  constructor(opts, build){
    super(opts, build)

    if(build){ return }

    let builder = new DatapartySrv.ServiceBuilder(this)

    builder.addSchema(Path.join(__dirname, './schema/venue_service.js'))

    builder.addMiddleware(DatapartySrv.middleware_paths.pre.decrypt)
    builder.addMiddleware(DatapartySrv.middleware_paths.pre.validate)

    builder.addMiddleware(DatapartySrv.middleware_paths.post.validate)
    builder.addMiddleware(DatapartySrv.middleware_paths.post.encrypt)

    builder.addEndpoint(DatapartySrv.endpoint_paths.identity)
    builder.addEndpoint(DatapartySrv.endpoint_paths.version)

    builder.addEndpoint(Path.join(__dirname, './endpoints/create-service.js'))
    builder.addAuth(Path.join(__dirname, './auth.js'))
  }
}

module.exports = VenueService
