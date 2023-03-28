

/**
 * @interface module:Config.IConfig
 * @link module.Config
 */
class IConfig {
    constructor(){}
    async start(){ throw 'not implemented' }
    async clear(){ throw 'not implemented' }
    readAll(){ throw 'not implemented' }
    read(key){ throw 'not implemented' }
    async write(key, data){ throw 'not implemented' }
    exists(key){ throw 'not implemented' }
    async save(){ throw 'not implemented' }
}

module.exports = IConfig