const dataparty_crypto = require('@dataparty/crypto')

const debug = require('debug')('dataparty.config.secure-config')
const deepSet = require('lodash').set

const reach = require('../utils/reach')

const IConfig = require('./iconfig')

const PASSWORD_HASHING_ROUNDS = 1000000
const DEFAULT_TIMEOUT_MS = 5*60*1000 //! 5min

const ARGON_TIME_COST = 3
const ARGON_MEMORY_COST = 65536 
const ARGON_PARALLELLISM = 4
const ARGON_TYPE = 'argon2id'

class SecureConfig extends IConfig {

    /**
     * @class   module:Config.SecureConfig
     * @implements  {module:Config.SecureConfig}
     * @link module.Config
     * @param {string}      id              The id of this secure config. Multiple secure configs can be stored within a single `IConfig`
     * @param {IConfig}     config          The underlying IConfig to use for storage
     * @param {number}      timeoutMs       Timeout since last unlock, after which the config will be locked. Defaults to 5 minutes.
     * @param {boolean}     includeActivity When set to `true` the timeout is reset after any read/write activity. Defaults to `true`
     * @param {Argon2}      argon           Instance of argon2 from either `npm:argon2` or `npm:argon2-browser`
     */
    constructor({
        id = 'secure-config',
        config, timeoutMs=DEFAULT_TIMEOUT_MS, includeActivity=true,
        argon
    }){
        super()
        this.id = id || 'secure-config'
        this.config = config

        this.argon = argon

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
     * @method module:Config.SecureConfig.start
     * @async
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
     * @method module:Config.SecureConfig.isInitialized
     * @returns {boolean}
     * @async
     */
    async isInitialized(){

        let keyType = await this.config.read(this.id+'.settings.type')

        if(keyType == 'pbkdf2'){

            let salt = await this.config.read(this.id+'.settings.salt')
            let rounds = await this.config.read(this.id+'.settings.rounds')

            return (salt != undefined && salt.length > 16 && rounds > 100000)

        } else if(keyType == 'argon2'){

            let salt = await this.config.read(this.id+'.settings.salt')
            let timeCost = await this.config.read(this.id+'.settings.timeCost')
            let memoryCost = await this.config.read(this.id+'.settings.memoryCost')
            let parallelism = await this.config.read(this.id+'.settings.parallelism')
            let argonType = await this.config.read(this.id+'.settings.argonType')

            return (salt != undefined && salt.length > 16 && memoryCost > 1024)

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
     * @method module:Config.SecureConfig.isLocked
     * @returns {boolean}
     */
    isLocked(){
        return this.content == null || this.identity == null
    }

    /**
     * Initialize the secure config with a password
     * @fires module:Config.SecureConfig#intialized
     * @fires module:Config.SecureConfig#ready
     * @method module:Config.SecureConfig.setPassword
     * @param {string} password 
     * @param {object} defaults 
     * @async
     */
    async setPassword(password, defaults={}){
        debug('setPassword')
        if(await this.isInitialized()){ throw new Error('already initialized') }

        let key = null
        let settings = null

        if(!this.argon){
            //! pbkdf2
            const salt = await dataparty_crypto.Routines.generateSalt()
            const rounds = PASSWORD_HASHING_ROUNDS

            settings = {
                type: 'pbkdf2',
                salt: salt.toString('hex'),
                rounds
            }
    
            key = await dataparty_crypto.Routines.createKeyFromPasswordPbkdf2(password, salt, rounds)

        } else if(this.argon){
            //! argon2

            const salt = await dataparty_crypto.Routines.generateSalt()
            let timeCost = ARGON_TIME_COST
            let memoryCost = ARGON_MEMORY_COST
            let parallelism = ARGON_PARALLELLISM
            let argonType = ARGON_TYPE

            settings = {
                type: 'argon2',
                salt: salt.toString('hex'),
                timeCost,
                memoryCost,
                parallelism,
                argonType
            }

            if(!this.argon){
                this.argon = argon
            }

            key = await dataparty_crypto.Routines.createKeyFromPasswordArgon2(
                this.argon,
                password,
                salt,
                timeCost,
                memoryCost,
                parallelism,
                argonType
            )
        } else {
            throw new Error('unsupported KDF['+type+']')
        }

        await this.initialize(key, defaults, settings)
    }

    /**
     * Initialize the secure config with a key
     * @fires module:Config.SecureConfig#intialized
     * @fires module:Config.SecureConfig#ready
     * @method module:Config.SecureConfig.setIdentity
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

    /**
     * Wait for config to be unlocked
     * @method module:Config.SecureConfig.waitForUnlocked
     * @param {string} reason   Optional reason message if config is locked
     * @async
     */
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
     * @method module:Config.SecureConfig.unlock
     * @param {string} password
     * @async
     */
    async unlock(password){

        if(this.timer != null){
            clearTimeout(this.timer)
            this.timer = null
        }

        let key = null
        let keyType = await this.config.read(this.id+'.settings.type')

        if(keyType == 'pbkdf2'){

            let salt = Buffer.from(await this.config.read(this.id+'.settings.salt'),'hex')
            let rounds = await this.config.read(this.id+'.settings.rounds')

            key = await dataparty_crypto.Routines.createKeyFromPasswordPbkdf2(password, salt, rounds)

        } else if(keyType == 'argon2'){

            let salt = Buffer.from(await this.config.read(this.id+'.settings.salt'), 'hex')
            let timeCost = await this.config.read(this.id+'.settings.timeCost')
            let memoryCost = await this.config.read(this.id+'.settings.memoryCost')
            let parallelism = await this.config.read(this.id+'.settings.parallelism')
            let argonType = await this.config.read(this.id+'.settings.argonType')


            key = await dataparty_crypto.Routines.createKeyFromPasswordArgon2(
                this.argon,
                password,
                salt,
                timeCost,
                memoryCost,
                parallelism,
                argonType
            )

        }


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
     * @method module:Config.SecureConfig.lock
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

    /**
     * @method module:Config.SecureConfig.clear
     * @async
     */
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

    /**
     * @method module:Config.SecureConfig.readAll
     * @async
     * @returns {object}
     */
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

    /**
     * @method module:Config.SecureConfig.read
     * @param {string}  key
     * @async
     */
    async read(key){ 
        debug('read',key)
        if(this.isLocked()){
            await this.waitForUnlocked('read key - '+key)
        }

        this.updateTimeout()

        const data = await this.readAll()

        return reach( data, key )
    }
    
    /**
     * @method module:Config.SecureConfig.write
     * @param {string}  key
     * @param {object}  data
     * @async
     */
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

    /**
     * @method module:Config.SecureConfig.save
     * @async
     */
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