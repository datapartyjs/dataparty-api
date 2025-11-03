var Buffer = require('buffer/').Buffer

if(!window.Buffer){
  window.Buffer = Buffer
}

const Comms = require('./comms')
const Party = require('./party/index-browser')
const Topics = require('./topics')
const Service = require('./service/index-browser')

const MemoryConfig = require('./config/memory')
const LocalStorageConfig = require('./config/local-storage')
const SecureConfig = require('./config/secure-config')

const Config = {
  MemoryConfig,
  LocalStorageConfig,
  SecureConfig
}

const Crypto = require('@dataparty/crypto')

let lib = {
  Crypto,
  Comms,
  Config,
  ...Party,
  ...Topics,
  ...Service
}


module.exports = lib
window.Dataparty = lib

