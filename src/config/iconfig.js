const EventEmitter = require('eventemitter3')

/**
 * @interface module:Config.IConfig
 * @link module.Config
 */
class IConfig extends EventEmitter {
    constructor(){super()}

    /**
     * @method module:Config.IConfig.start
     * @async
     */
    async start(){ throw 'not implemented' }

    /**
     * @method module:Config.IConfig.clear
     * @async
     */
    async clear(){ throw 'not implemented' }
    
    /**
     * @method module:Config.IConfig.readAll
     * @async
     * @returns {object}
     */
    async readAll(){ throw 'not implemented' }
    
    /**
     * @method module:Config.IConfig.read
     * @param {string}  key
     * @async
     */
    async read(key){ throw 'not implemented' }
    
    /**
     * @method module:Config.IConfig.write
     * @param {string}  key
     * @param {object}  data
     * @async
     */
    async write(key, data){ throw 'not implemented' }
    
    /**
     * @method module:Config.IConfig.exists
     * @param {string}  key
     * @async
     */
    async exists(key){ throw 'not implemented' }
    
    /**
     * @method module:Config.IConfig.save
     * @async
     */
    async save(){ throw 'not implemented' }
}

module.exports = IConfig