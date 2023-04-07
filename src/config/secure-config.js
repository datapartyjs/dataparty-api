const dataparty_crypto = require('@dataparty/crypto')

const debug = require('debug')('dataparty.config.secure-config')

const deepSet = require('lodash').set
const reach = require('../utils/reach')

const IConfig = require('./iconfig')

const PASSWORD_HASHING_ROUNDS = 1000000

class SecureConfig extends IConfig {
    constructor({
        id = 'secure-config',
        config, timeoutMs=60*10*1000, includeActivity=true
    }){
        this.id = id
        this.config = config

        this.content = null
        this.identity = null
        this.timer = null
        this.lastActivity = null
        this.timeoutMs = timeoutMs
        this.includeActivity = includeActivity
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
        let salt = this.config.read('salt')
        let rounds = this.config.read('rounds')

        return (salt.length == 32 && rounds > 100000)
    }

    isLocked(){
        return this.content == null || this.identity == null
    }

    async setPassword(password, defaults={}){
        debug('setPassword')
        if(await this.isInitialized()){ throw new Error('already initialized') }

        const salt = await dataparty_crypto.Routines.generateSalt()
        const rounds = PASSWORD_HASHING_ROUNDS

        let key = await dataparty_crypto.Routines.createKeyFromPassword(password, salt, rounds)

        const pwIdentity = new dataparty_crypto.Identity({
            key,
            id: this.id,
        })

        const initialContent = new dataparty_crypto.Message({ msg: defaults })
        
        await initialContent.encrypt(pwIdentity, pwIdentity.toMini())

        await this.config.write('salt', salt)
        await this.config.write('rounds', rounds)
        //await this.config.write('identity', pwIdentity.toJSON())
        await this.config.write('content',{
            enc: initialContent.enc,
            sig: initialContent.sig
        })

        debug('\t', 'identity', pwIdentity.toJSON)

        await this.config.save()

        this.emit('ready')
    }

    async waitForUnlocked(reason){

        if(!this.isLocked()){
            return
        }

        this.emit('blocked', reason)

        return new Promise((resolve,reject)=>{

            this.once('unlocked', resolve)

        })
    }

    async unlock(password){

        if(this.timer != null){
            clearTimeout(this.timer)
            this.timer = null
        }

        let salt = this.config.read('salt')
        let rounds = this.config.read('rounds')

        let key = await dataparty_crypto.Routines.createKeyFromPassword(password, salt, rounds)

        const pwIdentity = new dataparty_crypto.Identity({
            key,
            id: this.id,
        })

        const contentMsg = new dataparty_crypto.Message( this.config.read('content') )

        await contentMsg.decrypt(pwIdentity)

        this.content = this.config.read('content')
        this.identity = pwIdentity

        this.timer = setTimeout(this.onTimeout.bind(this), this.timeoutMs)

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
        this.timer = setTimeout(this.onTimeout.bind(this), this.timeoutMs)
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