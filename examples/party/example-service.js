const Dataparty = require('../../src/index')
const debug = require('debug')('example.service')

const Path = require('path')

class ExampleService extends Dataparty.IService {
  constructor(opts){
    super(opts)

    this.addSchema(Path.join(__dirname, './schema/user.js'))
    this.addSchema(Path.join(__dirname, './schema/basic_types.js'))

  }

}

module.exports = ExampleService