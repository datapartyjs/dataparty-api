const Path = require('path')

module.exports = {
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
    },
    post: {
      validate: require('./middleware/post/validate.js'),
      encrypt: require('./middleware/post/encrypt')
    }
  },
  middleware_paths: {
    pre: {
      decrypt: Path.join(__dirname, './middleware/pre/decrypt.js'),
      validate: Path.join(__dirname, './middleware/pre/validate.js')
    },
    post: {
      validate: Path.join(__dirname, './middleware/post/validate.js'),
      encrypt: Path.join(__dirname, './middleware/post/encrypt.js')
    }
  },
  endpoint: {
    echo: require('./endpoints/echo'),
    secureecho: require('./endpoints/secure-echo'),
    identity: require('./endpoints/service-identity'),
    version: require('./endpoints/service-version')
  },
  endpoint_paths: {
    echo: Path.join(__dirname, './endpoints/echo.js'),
    secureecho: Path.join(__dirname, './endpoints/secure-echo.js'),
    identity: Path.join(__dirname, './endpoints/service-identity.js'),
    version: Path.join(__dirname, './endpoints/service-version.js')
  }
}