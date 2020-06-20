const Path = require('path')

module.exports = {
  ISchema: require('./ischema'),
  IContext: require('./icontext'),
  IService: require('./iservice'),
  IEndpoint: require('./iendpoint'),
  IMiddleware: require('./imiddleware'),
  ServiceHost: require('./service-host'),
  ServiceRunner: require('./service-runner'),
  EndpointRunner: require('./endpoint-runner'),
  EndpointContext: require('./endpoint-context'),
  MiddlewareRunner: require('./middleware-runner'),
  middleware: {
    pre: {
      decrypt: require('./middleware/pre/decrypt'),
      validate: require('./middleware/pre/validate')
    }
  },
  middleware_paths: {
    pre: {
      decrypt: Path.join(__dirname, './middleware/pre/decrypt.js'),
      validate: Path.join(__dirname, './middleware/pre/validate.js')
    }
  },
  endpoint: {
    echo: require('./endpoints/echo'),
    identity: require('./endpoints/service-identity')
  },
  endpoint_paths: {
    echo: Path.join(__dirname, './endpoints/echo.js'),
    identity: Path.join(__dirname, './endpoints/service-identity.js')
  }
}