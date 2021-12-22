const Ajv = require('ajv')
const debug = require('debug')('dataparty.document-factory')
const IDocument = require('./idocument')

const DocumentValidationError = require('../errors/document-validation-error')


/**
 * @class
 */
class DocumentFactory {
  constructor({model, factories, party, documentClass}){
    this.factories = factories || {}
    this.party = party || null
    this.ajv = new Ajv()
    this.model = model
    this.documentClass = documentClass || IDocument
    this.validators = {}

    if(this.model){
      for(let schema of this.model.JSONSchema){
        const v = this.ajv.compile(schema)
        this.validators[schema.title] = v
        debug(schema.title)
      }
    }
  }

  /**
   * 
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
   * 
   * @param {*} type 
   * @param {*} factory 
   */
  addFactory(type, factory){
    this.factories[type] = factory
  }

  /**
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
   * @method
   */
  getTypes(){
    let types = ['document']
    return types.concat(Object.keys(this.factories))
  }

  /**
   * @method
   */
  getValidators(){
    return Object.keys(this.validators)
  }


  /**
   * @method
   */
  getFactories(){
    let factories = { document: this.documentClass }

    for(let name of this.getTypes()){
      factories[name] = this.getFactory(name)
    }

    return factories
  }

  /**
   * 
   * @param {*} type 
   * @param {*} id 
   * @param {*} data 
   */
  getDocument(type, id, data){
    let TypeFactory = this.getFactory(type)
    let instance = new TypeFactory({type, id, data, party: this.party})

    return instance
  }


  /**
   * 
   * @param {*} type 
   * @param {*} data 
   */
  validate(type, data){
    debug('validate',type)
    return new Promise((resolve, reject)=>{

      if(!this.validators[type]){
        debug('WARNING - validate with no such model type[', type, ']')
        return resolve(data)
      }

      let valid = this.validators[type](data)

      if(!valid){
        let errors = this.validators[type].errors

        return reject(new DocumentValidationError(errors))
      }

      return resolve(data)
    })
  }

  /** @type {IDocument} */
  get Document(){
    return this.documentClass
  }
}

module.exports = DocumentFactory