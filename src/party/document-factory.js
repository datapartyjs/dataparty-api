const Ajv = require('ajv')
const debug = require('debug')('dataparty.document-factory')
const IDocument = require('./idocument')

const reach = require('../utils/reach')

const DocumentValidationError = require('../errors/document-validation-error')



class DocumentFactory {
  /**
 * Represents document schemas mapped to contructor claasses which extend IDocument
 * @class module:Party.DocumentFactory
 * @extends EventEmitter
 * @link module.Party
 */
  constructor({model, factories, party, documentClass}){
    this.factories = factories || {}
    this.party = party || null
    this.ajv = new Ajv()
    //this.model = model
    this.documentClass = documentClass || IDocument
    this.validators = {}

    if(model){

      this.schemas = reach(this.model, 'schemas', model)

      for(let schema of this.schemas.JSONSchema){
        const v = this.ajv.compile(schema)
        this.validators[schema.title] = v
        debug(schema.title)
      }
    }
  }

  /**
   * @async
   * @method module:Party.DocumentFactory.hydrate
   * @param {*} found 
   */
  async hydrate(found){
    let documents = []
    for(let doc of found){
      let id = doc.$meta.id
      let type = doc.$meta.type
      let document = this.getDocument(type, id, doc)

      documents.push(document)
    }

    return documents
  }


  /**
   * @method module:Party.DocumentFactory.addFactory
   *
   * @param {*} type 
   * @param {*} factory 
   */
  addFactory(type, factory){
    this.factories[type] = factory
  }

  /**
   @method module:Party.DocumentFactory.getFactory
   * 
   * @param {*} type 
   */
  getFactory(type){
    if(this.factories && this.factories[type]){
      return this.factories[type]
    }

    return this.documentClass
  }

  /**
   * @method module:Party.DocumentFactory.getTypes
   */
  getTypes(){
    let types = ['document']
    return types.concat(Object.keys(this.factories))
  }

  /**
   * @method module:Party.DocumentFactory.getValidators
   */
  getValidators(){
    return Object.keys(this.validators)
  }


  /**
   * @method module:Party.DocumentFactory.getFactories
   */
  getFactories(){
    let factories = { document: this.documentClass }

    for(let name of this.getTypes()){
      factories[name] = this.getFactory(name)
    }

    return factories
  }

  /**
   * @method module:Party.DocumentFactory.getDocument
   * 
   * @param {string} type 
   * @param {string} id 
   * @param {Object} data 
   * @returns {module:Party.IDocument}
   */
  getDocument(type, id, data){
    let TypeFactory = this.getFactory(type)
    let instance = new TypeFactory({type, id, data, party: this.party})

    return instance
  }


  /**
   * @async
   * @method module:Party.DocumentFactory.validate
   * 
   * @param {*} type 
   * @param {*} data 
   */
  async validate(type, data){
    debug('validate',type)
    return new Promise((resolve, reject)=>{

      if(!this.validators[type]){
        debug('WARNING - validate with no such model type[', type, ']')
        return reject(new DocumentValidationError('no such validator'))
        //return resolve(data)
      }

      let valid = this.validators[type](data)

      if(!valid){
        let errors = this.validators[type].errors

        return reject(new DocumentValidationError(errors))
      }

      return resolve(data)
    })
  }

  /**
   * @member module:Party.IDocument.Document
   * @type {IDocument} */
  get Document(){
    return this.documentClass
  }
}

module.exports = DocumentFactory
