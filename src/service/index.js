const Path = require('path')

module.exports = {
  ISchema: require('./ischema'),
  IContext: require('./icontext'),
  IService: require('./iservice'),
  IEndpoint: require('./iendpoint'),
  IMiddleware: require('./imiddleware'),
  ServiceHost: require('./service-host'),
  middleware: {
    pre: {
      decrypt: require('./middleware/pre/decrypt')
    }
  },
  middleware_paths: {
    pre: {
      decrypt: Path.join(__dirname, './middleware/pre/decrypt.js')
    }
  }
}