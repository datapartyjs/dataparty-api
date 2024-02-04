const DatapartySrv = require('../service')
const debug = require('debug')('venue.service')

const Path = require('path')

class VenueService extends DatapartySrv.IService {
  constructor(opts){
    super(opts)

    //this.addSchema(Path.join(__dirname, './schema/ban_list.js'))
    this.addSchema(Path.join(__dirname, './schema/venue_service.js'))

    this.addMiddleware(DatapartySrv.middleware_paths.pre.decrypt)
    this.addMiddleware(DatapartySrv.middleware_paths.pre.validate)

    this.addMiddleware(DatapartySrv.middleware_paths.post.validate)
    this.addMiddleware(DatapartySrv.middleware_paths.post.encrypt)

    this.addEndpoint(DatapartySrv.endpoint_paths.identity)
    this.addEndpoint(DatapartySrv.endpoint_paths.version)

    this.addEndpoint(Path.join(__dirname, './endpoints/create-service.js'))
  }

}

module.exports = VenueService