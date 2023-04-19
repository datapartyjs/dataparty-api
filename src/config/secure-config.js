const dataparty_crypto = require('@dataparty/crypto')

const debug = require('debug')('dataparty.config.secure-config')
const deepSet = require('lodash').set

const reach = require('../utils/reach')

const IConfig = require('./iconfig')

const PASSWORD_HASHING_ROUNDS = 1000000
const DEFAULT_TIMEOUT_MS = 5*60*1000 //! 5min

class SecureConfig extends IConfig {

    /**
     * @class   module:Config.SecureConfig
     * @implements  {module:Config.SecureConfig}
     * @link module.Config
     * @param {string}      id              The id of this secure config. Multiple secure configs can be stored within a single `IConfig`
     * @param {IConfig}     config          The underlying IConfig to use for storage
     * @param {number}      timeoutMs       Timeout since last unlock, after which the config will be locked. Defaults to 5 minutes.
     * @param {boolean}     includeActivity When set to `true` the timeout is reset after any read/write activity. Defaults to `true`
     */
    constructor({
        id = 'secure-config',
        config, timeoutMs=DEFAULT_TIMEOUT_MS, includeActivity=true
    }){
        super()
        this.id = id || 'secure-config'
        this.config = config

        this.content = null
        this.identity = null
        this.timer = null
        this.lastActivity = null
        this.timeoutMs = timeoutMs || DEFAULT_TIMEOUT_MS
        this.includeActivity = (typeof includeActivity === 'boolean') ? includeActivity : true

        this.blocked = false
    }

    /**
     * Start the secure storage
     * @fires module:Config.SecureConfig#setup-required
     * @fires module:Config.SecureConfig#ready
     */
    async start(){
        await this.config.start()

        const isReady = await this.isInitialized()
        if(!isReady){
            /**
             * Setup required event. The secure config has not yet has a password
             * or key configured. 
             * @event module:Config.SecureConfig#setup-required
             */
            this.emit('setup-required')
        } else {
            /**
             * Ready event. The secure config is ready to be unlocked and have
             * configuration values read or written.
             * @event module:Config.SecureConfig#ready
             */
            this.emit('ready')
        }
    }

    /**
     * Checks if the secure config has initialized with a password or key
     * @returns {boolean}
     */
    async isInitialized(){

        let keyType = await this.config.read(this.id+'.settings.type')

        if(keyType == 'pbkdf2'){

            let salt = await this.config.read(this.id+'.settings.salt')
            let rounds = await this.config.read(this.id+'.settings.rounds')

            return (salt != undefined && salt.length > 16 && rounds > 100000)

        } else if(keyType == 'key'){
            return true
        } else if(!keyType) {
            return false
        } else {
            debug('type', keyType)
            throw new Error('unexpected key type')
        }
    }

    /**
     * Checks if the secure config is locked. If not locked the secure config
     * can be used without blocking waiting for user to unlock.
     * @returns {boolean}
     */
    isLocked(){
        return this.content == null || this.identity == null
    }

    /**
     * Initialize the secure config with a password
     * @fires module:Config.SecureConfig#intialized
     * @fires module:Config.SecureConfig#ready
     * @param {string} password 
     * @param {object} defaults 
     * @param {('pbkdf2')} type
     * @async
     */
    async setPassword(password, defaults={}, type='pbkdf2'){
        debug('setPassword')
        if(await this.isInitialized()){ throw new Error('already initialized') }

        let key = null
        let settings = null

        if(type == 'pbkdf2'){
            const salt = await dataparty_crypto.Routines.generateSalt()
            const rounds = PASSWORD_HASHING_ROUNDS

            settings = {
                type: type,
                salt: salt.toString('hex'),
                rounds
            }
    
            key = await dataparty_crypto.Routines.createKeyFromPassword(password, salt, rounds)

        } else {
            throw new Error('unsupported KDF['+type+']')
        }

        await this.initialize(key, defaults, settings)
    }

    /**
     * Initialize the secure config with a key
     * @fires module:Config.SecureConfig#intialized
     * @fires module:Config.SecureConfig#ready
     * @param {dataparty_crypto/IKey} key
     * @param {object}  defaults 
     * @async
     */
    async setIdentity(key, defaults){
        debug('setIdentity')
        if(await this.isInitialized()){ throw new Error('already initialized') }

        const settings = {
            key_type: 'key'
        }

        await this.initialize(key, defaults, settings)
    }


    async initialize(key, defaults, settings){
        debug('initialize - type:', settings.key_type)
        if(await this.isInitialized()){ throw new Error('already initialized') }

        const pwIdentity = new dataparty_crypto.Identity({
            key,
            id: this.id,
        })

        const insecureContent = {
            ...settings
        }

        const secureContent = {
            created: Date.now(),
            ...defaults
        }

        const initialContent = new dataparty_crypto.Message({ msg: secureContent })
        
        await initialContent.encrypt(pwIdentity, pwIdentity.toMini())

        await this.config.write(this.id+'.settings', insecureContent)
        await this.config.write(this.id+'.content', initialContent.toJSON())

        debug('\t', 'identity', pwIdentity)

        debug('\t', 'insecure content', insecureContent)

        debug('\t', 'secure content', secureContent)

        debug('\t', 'encrypted content', initialContent.toJSON())

        await this.config.save()

        
        const contentMsg = new dataparty_crypto.Message( initialContent )
        //! Verify message
        await contentMsg.decrypt(pwIdentity)
        /**
         * The secure config has been successfully initialized with a passowrd
         * or key.
         * @event module:Config.SecureConfig#intialized
         */
        this.emit('initialized')
        this.emit('ready')
    }


    async waitForUnlocked(reason){
        
        if(!this.isLocked()){
            return
        }
        
        debug('waitForUnlocked', reason)

        if(!this.blocked){
            /**
             * An read/write operation has been blocked due to the secure config
             * being locked. 
             * @event module:Config.SecureConfig#blocked
             * @type
             */
            this.emit('blocked', reason)
        }

        this.blocked = true


        let waiting = new Promise((resolve,reject)=>{

            this.once('unlocked', ()=>{
                this.blocked = false
                resolve()
                debug('waitForUnlocked - done')
            })

        })

        await waiting
    }

    /**
     * Unlocks the secure config
     * @fires module:Config.SecureConfig#unlocked
     * @param {string} password
     * @returns {Promise}
     */
    async unlock(password){

        if(this.timer != null){
            clearTimeout(this.timer)
            this.timer = null
        }

        let salt = Buffer.from(await this.config.read(this.id+'.settings.salt'),'hex')
        let rounds = await this.config.read(this.id+'.settings.rounds')

        let key = await dataparty_crypto.Routines.createKeyFromPassword(password, salt, rounds)

        const pwIdentity = new dataparty_crypto.Identity({
            key,
            id: this.id
        })


        this.content = await this.config.read(this.id+'.content')

        const contentMsg = new dataparty_crypto.Message( this.content )

        //! Verify message
        await contentMsg.decrypt(pwIdentity)

        this.identity = pwIdentity

        if(this.timeoutMs >= 0){
            this.timer = setTimeout(this.onTimeout.bind(this), this.timeoutMs)
        }

        /**
         * The secure config has been unlocked
         * @event module:Config.SecureConfig#unlocked
         */
        this.emit('unlocked')
    }

    /**
     * Locks the secure config
     * @fires module:Config.SecureConfig#locked
     * @param {string} password 
     */
    lock(){
        if(this.timer != null){
            clearTimeout(this.timer)
            this.timer = null
        }

        delete this.content
        delete this.identity

        this.content = null
        this.identity = null

        /**
         * The secure config has been locked
         * @event module:Config.SecureConfig#locked
         */
        this.emit('locked')
    }

    onTimeout(){
        this.timer = null
        this.lock()
        this.emit('timeout')

        debug('timeout')
    }

    updateTimeout(){
        if(!this.includeActivity && !this.isLocked()){
            return
        }

        clearTimeout(this.timer)

        if(this.timeoutMs >= 0){
            this.timer = setTimeout(this.onTimeout.bind(this), this.timeoutMs)
        }
        this.lastActivity = Date.now()
    }

    async clear(){ 
        debug('clear')
        if(this.isLocked()){
            await this.waitForUnlocked('clearing config')
        }

        this.updateTimeout()

        const updatedContent = new dataparty_crypto.Message({ msg: {} })
        await updatedContent.encrypt(this.identity, this.identity.toMini())

        this.content = updatedContent.toJSON()
        await this.save()
    }

    async readAll(){
        debug('readAll')
        if(this.isLocked()){
            await this.waitForUnlocked('read all')
        }
        
        this.updateTimeout()

        const decryptedContent = new dataparty_crypto.Message( this.content )
        await decryptedContent.decrypt(this.identity)

        return decryptedContent.msg
    }

    async read(key){ 
        debug('read',key)
        if(this.isLocked()){
            await this.waitForUnlocked('read key - '+key)
        }

        this.updateTimeout()

        const data = await this.readAll()

        return reach( data, key )
    }
    
    async write(key, value){ 
        debug('write',key)
        if(this.isLocked()){
            await this.waitForUnlocked('write key - '+key)
        }

        this.updateTimeout()

        let data = await this.readAll()

        deepSet(data, key, value)


        const updatedContent = new dataparty_crypto.Message({ msg: data })
        await updatedContent.encrypt(this.identity, this.identity.toMini())

        this.content = updatedContent.toJSON()

        await this.save()
    }

    async exists(key){ 
        return (await this.read(key)) !== undefined
    }

    async save(){ 
        debug('save')
        if(this.isLocked()){
            await this.waitForUnlocked('save config')
        }

        this.updateTimeout()

        await this.config.write(this.id+'.content',{
            enc: this.content.enc,
            sig: this.content.sig
        })
    }
}

module.exports = SecureConfig