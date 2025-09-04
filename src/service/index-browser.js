const Path = require('path')

/**
 * @module Service
 */


exports.IContext= require('./icontext')
exports.IService= require('./iservice')
exports.IEndpoint= require('./iendpoint')
exports.IMiddleware= require('./imiddleware')
exports.ITask = require('./itask')
exports.ITopic = require('./itopic')
exports.RunnerRouter= require('./runner-router')
exports.ServiceRunnerNode= require('./service-runner-node')
exports.EndpointContext= require('./endpoint-context')

exports.middleware = {
  pre: {
    decrypt: require('./middleware/pre/decrypt'),
    validate: require('./middleware/pre/validate')
  },
  post: {
    validate: require('./middleware/post/validate.js'),
    encrypt: require('./middleware/post/encrypt')
  }
}

exports.middleware_paths = {
  pre: {
    decrypt: Path.join(__dirname, './middleware/pre/decrypt.js'),
    validate: Path.join(__dirname, './middleware/pre/validate.js')
  },
  post: {
    validate: Path.join(__dirname, './middleware/post/validate.js'),
    encrypt: Path.join(__dirname, './middleware/post/encrypt.js')
  }
}

exports.endpoint = {
  echo: require('./endpoints/echo'),
  secureecho: require('./endpoints/secure-echo'),
  identity: require('./endpoints/service-identity'),
  version: require('./endpoints/service-version')
}

exports.endpoint_paths = {
  echo: Path.join(__dirname, './endpoints/echo.js'),
  secureecho: Path.join(__dirname, './endpoints/secure-echo.js'),
  identity: Path.join(__dirname, './endpoints/service-identity.js'),
  version: Path.join(__dirname, './endpoints/service-version.js')
}