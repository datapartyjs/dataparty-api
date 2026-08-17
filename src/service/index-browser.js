const Path = require('path')

/**
 * @module Service
 */


exports.IAuth = require('./iauth')
exports.IContext= require('./icontext')
exports.IService= require('./iservice')
exports.IEndpoint= require('./iendpoint')
exports.IMiddleware= require('./imiddleware')
exports.ITask = require('./itask')
exports.ITopic = require('./itopic')
exports.ServiceHostPeer= require('./service-host-peer')
exports.RunnerRouter= require('./runner-router')
exports.ServiceRunnerNode= require('./service-runner-node')
exports.EndpointContext= require('./endpoint-context')

exports.middleware = {
  pre: {
    decrypt: require('./middleware/pre/decrypt'),
    validate: require('./middleware/pre/validate'),
    ephemeral_session: require('./middleware/pre/ephemeral-session.js')
  },
  post: {
    validate: require('./middleware/post/validate.js'),
    encrypt: require('./middleware/post/encrypt')
  }
}

exports.middleware_paths = {
  pre: {
    decrypt: Path.join(__dirname, './middleware/pre/decrypt.js'),
    validate: Path.join(__dirname, './middleware/pre/validate.js'),
    ephemeral_session: Path.join(__dirname, './middleware/pre/ephemeral-session.js')
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
  version: require('./endpoints/service-version'),
  key_announce: require('./endpoints/key-announce')
}

exports.endpoint_paths = {
  echo: Path.join(__dirname, './endpoints/echo.js'),
  secureecho: Path.join(__dirname, './endpoints/secure-echo.js'),
  identity: Path.join(__dirname, './endpoints/service-identity.js'),
  version: Path.join(__dirname, './endpoints/service-version.js'),
  key_announce: Path.join(__dirname, './endpoints/key-announce.js')
}

exports.schema = {
  public_key: require('./schema/public-key'),
  session_key: require('./schema/session-key')
}

exports.schema_paths = {
  public_key: Path.join(__dirname, './schema/public-key.js'),
  session_key: Path.join(__dirname, './schema/session-key.js')
}

exports.task = {
  cleanup_ephemeral_sessions: require('./tasks/cleanup-ephemeral-sessions.js')
}

exports.task_paths = {
  cleanup_ephemeral_sessions: Path.join(__dirname, './tasks/cleanup-ephemeral-sessions.js')
}