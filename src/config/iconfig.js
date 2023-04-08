const EventEmitter = require('eventemitter3')

/**
 * @interface module:Config.IConfig
 * @link module.Config
 */
class IConfig extends EventEmitter {
    constructor(){super()}
    async start(){ throw 'not implemented' }
    async clear(){ throw 'not implemented' }
    async readAll(){ throw 'not implemented' }
    async read(key){ throw 'not implemented' }
    async write(key, data){ throw 'not implemented' }
    async exists(key){ throw 'not implemented' }
    async save(){ throw 'not implemented' }
}

module.exports = IConfig