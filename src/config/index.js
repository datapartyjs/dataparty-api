const NconfConfig = require('./nconf')
const MemoryConfig = require('./memory')
const JsonFileConfig = require('./json-file')
const LocalStorageConfig = require('./local-storage')

/**
 * Config
 * @namespace Config
 */
const Config = {
  NconfConfig,
  MemoryConfig,
  JsonFileConfig,
  LocalStorageConfig
}

module.exports = Config