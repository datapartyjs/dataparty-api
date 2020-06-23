const DatapartySrv = require('../service')
const debug = require('debug')('venue.service')

class VenueService extends DatapartySrv.IService {
  constructor(opts){
    super(opts)

    this.addMiddleware(DatapartySrv.middleware_paths.pre.decrypt)
    this.addMiddleware(DatapartySrv.middleware_paths.pre.validate)

    this.addMiddleware(DatapartySrv.middleware_paths.post.validate)
    this.addMiddleware(DatapartySrv.middleware_paths.post.encrypt)

    this.addEndpoint(DatapartySrv.endpoint_paths.echo)
    this.addEndpoint(DatapartySrv.endpoint_paths.secureecho)
    this.addEndpoint(DatapartySrv.endpoint_paths.identity)
    this.addEndpoint(DatapartySrv.endpoint_paths.version)
  }

}

module.exports = VenueService