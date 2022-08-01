const NconfConfig = require('./nconf')
const MemoryConfig = require('./memory')
const JsonFileConfig = require('./json-file')
const LocalStorageConfig = require('./local-storage')

module.exports = {
  NconfConfig,
  MemoryConfig,
  JsonFileConfig,
  LocalStorageConfig
}