const Comms = require('./comms')
const Party = require('./party/index-browser')
const Topics = require('./topics')

const MemoryConfig = require('./config/memory')
const LocalStorageConfig = require('./config/local-storage')
const SecureConfig = require('./config/secure-config')

const Config = {
  MemoryConfig,
  LocalStorageConfig,
  SecureConfig
}


let lib = {
  Comms,
  Config,
  ...Party,
  ...Topics
}


module.exports = lib
window.Dataparty = lib