const NconfConfig = require('./nconf')
const MemoryConfig = require('./memory')
const JsonFileConfig = require('./json-file')
const LocalStorageConfig = require('./local-storage')

/**
 * @module Config
 */
const Config = {
  NconfConfig,
  MemoryConfig,
  JsonFileConfig,
  LocalStorageConfig
}

module.exports = Config