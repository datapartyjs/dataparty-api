const dataparty_crypto = require('@dataparty/crypto')

const debug = require('debug')('dataparty.config.secure-config')

const deepSet = require('lodash').set
const reach = require('../utils/reach')

const IConfig = require('./iconfig')

const PASSWORD_HASHING_ROUNDS = 1000000
const DEFAULT_TIMEOUT_MS = 5*60*1000 //! 5min

class SecureConfig extends IConfig {
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
        this.includeActivity = includeActivity || true

        this.blocked = false
    }

    async start(){
        await this.config.start()

        const isReady = await this.isInitialized()
        if(!isReady){
            this.emit('setup-required')
        } else {
            this.emit('ready')
        }
    }

    async isInitialized(){
        let salt = await this.config.read('salt')
        let rounds = await this.config.read('rounds')


        return (salt != undefined && salt.length > 16 && rounds > 100000)
    }

    isLocked(){
        return this.content == null || this.identity == null
    }

    async setPassword(password, defaults={}){
        debug('setPassword')
        if(await this.isInitialized()){ throw new Error('already initialized') }

        const salt = await dataparty_crypto.Routines.generateSalt()
        const rounds = PASSWORD_HASHING_ROUNDS


        await this.config.write('salt', salt.toString('hex'))
        await this.config.write('rounds', rounds)

        let key = await dataparty_crypto.Routines.createKeyFromPassword(password, salt, rounds)

        await this.setIdentity(key)
    }

    async setIdentity(key){
        debug('setIdentity')
        if(await this.isInitialized()){ throw new Error('already initialized') }

        const pwIdentity = new dataparty_crypto.Identity({
            key,
            id: this.id,
        })

        const initialContent = new dataparty_crypto.Message({ msg: defaults })
        
        await initialContent.encrypt(pwIdentity, pwIdentity.toMini())

        await this.config.write('content', initialContent.toJSON())

        debug('\t', 'identity', pwIdentity)

        debug('\t', 'content', initialContent.toJSON())

        await this.config.save()

        
        const contentMsg = new dataparty_crypto.Message( initialContent )
        //! Verify message
        await contentMsg.decrypt(pwIdentity)
        this.emit('ready')
    }

    async waitForUnlocked(reason){
        
        if(!this.isLocked()){
            return
        }
        
        debug('waitForUnlocked', reason)

        if(!this.blocked){
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

    async unlock(password){

        if(this.timer != null){
            clearTimeout(this.timer)
            this.timer = null
        }

        let salt = Buffer.from(await this.config.read('salt'),'hex')
        let rounds = await this.config.read('rounds')

        let key = await dataparty_crypto.Routines.createKeyFromPassword(password, salt, rounds)

        const pwIdentity = new dataparty_crypto.Identity({
            key,
            id: this.id
        })


        this.content = await this.config.read('content')

        const contentMsg = new dataparty_crypto.Message( this.content )

        //! Verify message
        await contentMsg.decrypt(pwIdentity)

        this.identity = pwIdentity

        if(this.timeoutMs >= 0){
            this.timer = setTimeout(this.onTimeout.bind(this), this.timeoutMs)
        }

        this.emit('unlocked')
    }

    lock(){
        if(this.timer != null){
            clearTimeout(this.timer)
            this.timer = null
        }

        delete this.content
        delete this.identity

        this.content = null
        this.identity = null

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

        await this.config.write('content',{
            enc: this.content.enc,
            sig: this.content.sig
        })
    }
}

module.exports = SecureConfig