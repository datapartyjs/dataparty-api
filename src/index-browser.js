const Comms = require('./comms')
const Party = require('./party/index-browser')

const MemoryConfig = require('./config/memory')
const LocalStorageConfig = require('./config/local-storage')

const Config = {
  MemoryConfig,
  LocalStorageConfig
}


let lib = {
  Comms,
  Config,
  ...Party
}


module.exports = lib