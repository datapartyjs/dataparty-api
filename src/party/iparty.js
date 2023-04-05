const debug = require('debug')('dataparty.iparty')
const dataparty_crypto = require('@dataparty/crypto')

const ROSLIB = require('roslib')

const Query = require('./query.js')
const IDocument = require('./idocument')
const DocumentFactory = require('./document-factory')
const LokiCache = require('./loki-cache.js') // insert | populate cache


class IParty {
/**
 * @class module:Party.IParty
 * @link module.Party
 *
 * @param {module:Config.IConfig}   options.config
 * @param {module:Party.LokiCache}  options.cache
 * @param {boolean}                 options.noCache
 * @param {module:Comms.ISocketComms} options.comms
 * @param {Object}                  options.model
 * @param {Object}                  options.factories
 * @param {module:Party.IDocument}  options.documentClass
 * @param {module:Party.Qb}         options.qb
 */
  constructor({config, cache, noCache=false, comms, model, factories, documentClass, qb=null}){
    this.config = config
    this.qb = qb

    if(noCache){ this.cache = null }
    else{ this.cache = cache || new LokiCache() }
    
    this.comms = comms
    
    this._actor = {id: undefined, type: undefined}
    this._actors = []
    this._identity = undefined
    this.started = false

    /**
     * @member module:Party.IParty.factory
     * @type {DocumentFactory} */
    this.factory = new DocumentFactory({party: this, model, factories, documentClass})
  }

  /**
   * @async
   *  @method module:Party.IParty.start */
  async start(){
    
    if(this.started){ return }

    debug('start')
    if(this.config){
      await this.config.start()
    }

    if(this.cache){
      await this.cache.start()
    }

    await Promise.all([
      this.loadIdentity(),
      this.loadActor(),
    ])

    this.started = true

    debug('\tDocument Validators', this.factory.getValidators())
    debug('\tDocument Classes', this.factory.getTypes())
  }

  /**
   * @async
   * @method module:Party.IParty.createDocument
   */
  async createDocument(type, data, id){
    let Type = this.factory.getFactory(type)


    return await Type.create(this, {data, type, id})
  }

  /**
   * @async
   * @method module:Party.IParty.create
   */
  async create (type, ...msgs) {
    return await this.qb.create(type, msgs)
  }


  /**
   * @async
   * @method module:Party.IParty.remove
   */
  async remove (...msgs) {
    return this.qb.modify(msgs, 'remove')
  }

  // takes modified json msgs & writes to backend, resolves to new stamps
  // requires type & id
  /**
   * @async
   * @method module:Party.IParty.update
   */
  async update (...msgs) {
    return this.qb.modify(msgs, 'update')
  }

  /**
   * Starts a query
   * @method module:Party.IParty.find
   * @returns {module:Party.Query}
   */
  find () {
    return new Query(this.qb, this.factory)
  }

 

  /**
   * @async
   * @method module:Party.IParty.call
   */
  async call(msg){
    throw new Error('Not Implemented')
  }

  /**
   * @method
   */
  async socket(reuse){
    throw new Error('Not Implemented')
  }

  

  /**
   * @member module:Party.IParty.ROSLIB
   *  @type {ROSLIB} */
  get ROSLIB(){
    return ROSLIB
  }


  /**
   * @member module:Party.IParty.Document
   *  @type {IDocument} */
  get Document(){
    return this.factory.Document
  }

  /**
   * @member module:Party.IParty.types
   */
  get types(){
    return this.factory.getFactories()
  }

  /**
   * @member module:Party.IParty.identity
   * @type {module:dataparty/Types.Identity}
   */
  get identity(){
    if (!this.hasIdentity()){ return undefined }
    return dataparty_crypto.Identity.fromString(this._identity.toString())
  }

  /**
   * @member module:Party.IParty.privateIdentity
   * @type {module:dataparty/Types.Identity}
   */
  get privateIdentity(){
    if (!this.hasIdentity()){ return undefined }
    return this._identity
  }

  /**
   *  @member module:Party.IParty.actor 
   * @type {IdObj} */
  get actor(){
    if (this.actors && this.actors[0]){

      return this.actors[0]

    } else if (this._actor.id && this._actor.type){

      return this._actor

    }

    return undefined
  }

  /**
   *  @member module:Party.IParty.actors 
   * @type {IdObj[]} */
  get actors(){
    return this._actors
  }

  set actors(value){
    this._actors = value

    const primaryActor = this.actor

    if (!primaryActor){
     return
    }

    this._actor.id = primaryActor.id
    this._actor.type = primaryActor.type

    const path = 'actor'
    this.config.write(path, this._actor)
  }

  /**
   * @method module:Party.IParty.hasIdentity
   */
  hasIdentity(){
    return this._identity != undefined
  }

  /**
   * @method module:Party.IParty.hasActor
   */
  hasActor(){
    return this.actor != undefined
  }



  /**
   * @async
   * @method module:Party.IParty.loadIdentity
   */
  async loadIdentity(){
    const path = 'identity'
    const cfgIdenStr = this.config.read(path)

    if (!cfgIdenStr){
      debug('generated new identity')
      
      await this.resetIdentity()
    } else {
      debug('loaded identity')
      this._identity = dataparty_crypto.Identity.fromString(JSON.stringify(cfgIdenStr))
    }
  }

  /**
   * @async
   * @method module:Party.IParty.resetIdentity
   */
  async resetIdentity(){
    const path = 'identity'
    await this.config.write(path, null)

    this._identity = new dataparty_crypto.Identity({id: 'primary'})
    await this.config.write(path, this._identity.toJSON(true))

    await this.loadIdentity()
  }

  /**
   * @async
   * @method module:Party.IParty.loadActor
   */
  async loadActor(){
    const path = 'actor'
    const localActorObj = this.config.read(path)

    if (!localActorObj){ return }

    this._actor.id = localActorObj.id
    this._actor.type = localActorObj.type

    debug('loaded actor', this._actor)
  }

    /**
   * @async
   * @method module:Party.IParty.encrypt
   * @param {any} data
   * @param {dataparty_crypto.Identity} to
   * @returns {dataparty_crypto.Message}
   */
  async encrypt(data, to){
    const msg = new dataparty_crypto.Message({msg: data})
    await msg.encrypt(this._identity, to.key)

    return msg
  }

  /**
   * @async
   * @method module:Party.IParty.decrypt
   * @param {dataparty_crypto.Message} reply
   * @param {dataparty_crypto.Identity} expectedSender
   * @param {boolean} expectClearTextReply
   */
  async decrypt(reply, expectedSender, expectClearTextReply = false){
    // if reply has ciphertext & sig attempt to decrypt
    if (reply.enc && reply.sig) {
      const msg = new dataparty_crypto.Message(reply)

      const replyContent = await msg.decrypt(this._identity)

      const publicKeys = dataparty_crypto.Routines.extractPublicKeys(msg.enc)

      debug(`publicKeys.sign - ${publicKeys.sign}`)

      if (publicKeys.sign !== expectedSender.key.public.sign ||
          publicKeys.box !== expectedSender.key.public.box) {
        throw new Error('TrustFail: reply is not from service')
      }

      debug('decrypted reply ->', JSON.stringify(replyContent))

      if (replyContent.error) {
        debug('call failed ->', replyContent.error)
        throw replyContent.error
      }

      return replyContent

    } else if (expectClearTextReply && !reply.error) {

      return reply

    }

    if (reply.error) {
      debug('call failed ->', reply.error)
      throw reply.error
    }

    throw new Error('TrustFail: reply is not encrypted')
  }
}

module.exports = IParty