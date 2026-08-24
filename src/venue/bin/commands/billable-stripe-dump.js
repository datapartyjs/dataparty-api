const CmdTree = require('command-tree')
const Hoek = require('@hapi/hoek')
const debug = require('debug')('venue.billable-stripe-dump')
const Path = require('path')
const OS = require('os')
const fs = require('fs')

const prompt = require('prompt')
const argon2 = require('argon2')

const { execSync } = require('child_process')

const Dataparty = require('../../../../')
const dataparty_crypto = require('@dataparty/crypto')

const reach = require('../../../utils/reach')

const Stripe = require('stripe')

const DEFINITION = {
  h: {
    description: 'Show help',
    alias: 'help',
    type: 'help'
  },
  identity: {
    type: 'string',
    description: 'Name of deverloper identity'
  },
  remote: {
    type: 'string',
    description: 'Name of remote hosting billing service'
  },
  project: {
    type: 'string',
    description: 'Name of project',
    require: true
  }
}


class VenueBillableStripeDump extends CmdTree.Command {
  constructor(context){
    super({...VenueBillableServiceCreate.Definition, context})
    debug('constructor')
  }
  
  static get Command(){
    return 'stripe dump'
  }
  
  static get Definition(){
    return {
      usage: `venue stripe dump`,
      description: 'Dump stripe product info from live service',
      definition: DEFINITION
    }
  }
  
  async run({parsed}){
    if (parsed.h) {
      throw new CmdTree.Error.HelpRequest('help request')
    }


    const keyName = parsed.identity || process.env.VENUE_IDENTITY

    const phrase = await this.context.secureConfig.read('identity.'+keyName+'.phrase')

    if(!phrase){
      throw new CmdTree.Error.UsageError("Key doesn't exist!")
    }

    const {password} = parsed.nopassword ? {password:null} : await prompt.get({
            properties: {
                password: {
                    message: 'Enter password for identity['+keyName+']',
                    hidden: true
            }
        }})

    let key = await dataparty_crypto.Identity.fromMnemonic(phrase, password, argon2)

    key.id = keyName
    const remoteName = parsed.remote || process.env.VENUE_REMOTE
    const remote = await this.context.secureConfig.read('remote.'+remoteName)

    const configPath = 'secrets.'+key.key.hash+'.'+key.key.hash+'.'+ parsed.project +'.payment_methods'

    const owner = key
    let paymentMethods = null
    let secureContent = await this.context.secureConfig.read(configPath)

    if(!secureContent){
      secureContent = await this.context.secureConfig.saveSecret(configPath, owner, owner, {
        
      })
      paymentMethods = await this.context.secureConfig.decryptFromBase64(owner, owner, secureContent)
    } else {
      paymentMethods = await this.context.secureConfig.decryptFromBase64(owner, owner, secureContent)
    }

    console.log('loaded payment methods ->', paymentMethods)



    const stripe = require('stripe')(paymentMethods.stripe.secret)


    const products = await stripe.products.list({
      limit: 30,
      active: true
    });

    const prices = await stripe.prices.list({
      limit: 30,
      active: true
    });

    console.log('===PRODUCTS===')
    console.log(products.data.map(prod=>{
      return {
        name: prod.name,
        id: prod.id,
        images: prod.images,
        desc: prod.description,
        default_price: prod.default_price
      }
    }))

    console.log('===PRICES===')
    console.log(JSON.stringify(prices,null,2))

    return {}
  }

}
module.exports = VenueBillableStripeDump


