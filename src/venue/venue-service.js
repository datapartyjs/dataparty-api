const DatapartySrv = require('../service')
const debug = require('debug')('venue.service')

const Path = require('path')

class VenueService extends DatapartySrv.IService {
  constructor(opts, build){
    super(opts, build)

    if(build){ return }

    let builder = new DatapartySrv.ServiceBuilder(this)


    //builder.addSchema(Path.join(__dirname, './schema/public-key.js'))
    //builder.addSchema(Path.join(__dirname, './schema/session-key.js'))
    builder.addSchema(Path.join(__dirname, './schema/venue_package.js'))
    builder.addSchema(Path.join(__dirname, './schema/venue_project.js'))

    builder.addSchema(DatapartySrv.schema_paths.public_key)
    builder.addSchema(DatapartySrv.schema_paths.session_key)

    builder.addMiddleware(DatapartySrv.middleware_paths.pre.decrypt)
    builder.addMiddleware(DatapartySrv.middleware_paths.pre.validate)
    builder.addMiddleware(DatapartySrv.middleware_paths.pre.ephemeral_session)

    //builder.addMiddleware(Path.join(__dirname, './middleware/pre/ephemeral-session.js'))

    builder.addMiddleware(DatapartySrv.middleware_paths.post.validate)
    builder.addMiddleware(DatapartySrv.middleware_paths.post.encrypt)

    builder.addEndpoint(DatapartySrv.endpoint_paths.identity)
    builder.addEndpoint(DatapartySrv.endpoint_paths.version)
    builder.addEndpoint(DatapartySrv.endpoint_paths.key_announce)

    //builder.addEndpoint(Path.join(__dirname, './endpoints/key-announce.js'))

    builder.addEndpoint(Path.join(__dirname, './endpoints/create-package.js'))
    builder.addEndpoint(Path.join(__dirname, './endpoints/create-project.js'))


    builder.addTask(Path.join(__dirname,'./tasks/cleanup-ephemeral-sessions.js'))

    builder.addAuth(Path.join(__dirname, './auth.js'))

    builder.addFiles(__dirname, [
      'public/*',
      'public/dist/dataparty-browser.*',
      'public/node_modules/argon2-browser/dist/*'
    ], { nodir: true, follow: true })
  }
}

module.exports = VenueService
