const Comms = require('./comms')
const Config = require('./config')
const Party = require('./party')

module.exports = {
  Comms,
  Config,
  ...Party
}