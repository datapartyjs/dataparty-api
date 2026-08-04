const CmdTree = require('command-tree')
const Hoek = require('@hapi/hoek')
const debug = require('debug')('venue.billable-service-create')
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
  },
  deploy: {
    type:'boolean',
    description: 'deploy the billing definition to the remote'
  },
  stripe: {
    type: 'boolean',
    description: 'Enable stripe payment processing'
  },
  'stripe-secret': {
    type: 'string',
    description: 'Stripe secret key (see: https://dashboard.stripe.com/apikeys)'
  },
  'stripe-publishable': {
    type: 'string',
    description: 'Stripe publishable key (see: https://dashboard.stripe.com/apikeys)'
  },
  'stripe-sig-secret': {
    type: 'string',
    description: 'Stripe webhook signing secret (see: https://dashboard.stripe.com/workbench/webhooks)'
  },
  'stripe-product': {
    type: 'string',
    description: 'stripe product id to offer for sale'
  },
  'stripe-price': {
    type: 'string',
    description: 'stripe price id to offer for sale',
    multiple: true
  },
  'stripe-ui-mode': {
    type: 'string',
    default: 'embedded_page',
    valid: ['embedded_page', 'hosted_page', 'elements'],
    description: 'Stripg ui mode (see: https://docs.stripe.com/api/checkout/sessions/create#create_checkout_session-ui_mode)'
  },
  'stripe-return-url': {
    type: 'string',
    description: 'Stripe return url (see: https://docs.stripe.com/api/checkout/sessions/create#create_checkout_session-return_url)'
  }
}


class VenueBillableServiceCreate extends CmdTree.Command {
  constructor(context){
    super({...VenueBillableServiceCreate.Definition, context})
    debug('constructor')
  }
  
  static get Command(){
    return 'billable create'
  }
  
  static get Definition(){
    return {
      usage: `venue billable create`,
      description: 'Create a billable service',
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

    //let paymentMethods = await 

    console.log('loaded payment methods ->', paymentMethods)

    if(parsed.stripe){
      console.log('stripe mode')

      const stripeSecret = parsed['stripe-secret'] || process.env.VENUE_STRIPE_SECRET
      const stripePublishable = parsed['stripe-publishable'] || process.env.VENUE_STRIPE_PUBLISHABLE
      const stripeSigningSecret = parsed['stripe-sig-secret'] || process.env.VENUE_STRIPE_SIGNING_SECRET


      if(!paymentMethods.stripe){
        paymentMethods.stripe = {
          secret: stripeSecret,
          publishable: stripePublishable,
          sig_secret: stripeSigningSecret
        }
      } else {
        paymentMethods.stripe = {
          secret: stripeSecret || paymentMethods.stripe.secret,
          publishable: stripePublishable || paymentMethods.stripe.publishable,
          sig_secret: stripeSigningSecret || paymentMethods.stripe.sig_secret
        }
      }

      await this.context.secureConfig.saveSecret(configPath, owner, owner, paymentMethods)

      console.log('saved stripe details ->', paymentMethods)
    }

    const remoteIdentityPath = `remote.${remoteName}.identity`
    const remoteIdentity = dataparty_crypto.Identity.fromJSON(await this.context.secureConfig.read(remoteIdentityPath))

    console.log('remote identity - ', remoteIdentity.key.hash)

    const partyIdentityPath = `secrets.${owner.key.hash}.${owner.key.hash}.${parsed.project}.party.main.identity`
    const partyIdentity = dataparty_crypto.Identity.fromBSON(await this.context.secureConfig.readSecret(partyIdentityPath, owner, owner))

    console.log('party identity - ', partyIdentity.key.hash)

    const billableService = {
      owner: owner.key.hash,
      identity: partyIdentity.key.hash,//
      stripe_ui_mode: parsed['stripe-ui-mode'] || 'embedded_page',
      stripe_return_url: parsed['stripe-return-url'],
      payment_methods: await this.context.secureConfig.encryptToBase64(owner, remoteIdentity, paymentMethods),
      products: []
    }

    const stripe = require('stripe')(paymentMethods.stripe.secret)
    if(parsed['stripe-product']){

      const productInfo = await stripe.products.list({
        limit: 30,
        active: true,
        ids: [parsed['stripe-product']]
      })

      const productToAdd = {
        name: productInfo.data[0].name,
        description: productInfo.data[0].description,
        photos_uri: productInfo.data[0].photos,
        stripe_product_id: productInfo.data[0].id,

        prices: []
      }

      console.log('add stripe product', parsed['stripe-product'])

      const priceList = await stripe.prices.list({
        limit: 30,
        active: true,
        product: parsed['stripe-product']
      });



      for(let stripePrice of priceList.data){

        if(parsed['stripe-price'].indexOf(stripePrice.id) == -1){
          continue
        }


        console.log('\tadd stripe price', stripePrice.id)

        const itemPrice = {
          one_time_purchase: stripePrice.type == 'one_time',
          period_unit: reach(stripePrice, 'recurring.interval'),
          stripe_price_id: stripePrice.id
        }

        productToAdd.prices.push( itemPrice )

      }

      billableService.products.push( productToAdd )

    }

    

    const ownerSig = await owner.sign( billableService, true )
    const partySig = await partyIdentity.sign( billableService, true )

    billableService.signatures = {
      [owner.key.hash]: dataparty_crypto.Routines.Utils.base64.encode(ownerSig.sig),
      [partyIdentity.key.hash]: dataparty_crypto.Routines.Utils.base64.encode(partySig.sig)
    }


    console.log('billableService', billableService)
    console.log('products', JSON.stringify(billableService.products,null,2))

    if(parsed.deploy){
      console.log('deploying to [',remoteName,'] ... ')

      //! announce the party's key
      let client = new Dataparty.EphemeralClient({
        identity: partyIdentity,
        urlOrParty: remote.url,
        wsUrlOrParty: remote.ws,
        allowSelfSigned: remote.allowSelfSigned
      })

      await client.start()
      await client.stop()

      await this.pushBillableService(owner, remote, billableService)

    }

    /*
    const products = await stripe.products.list({
      limit: 30,
      active: true
    });

    const prices = await stripe.prices.list({
      limit: 30,
      active: true
    });

    console.log(products.data.map(prod=>{
      return {
        name: prod.name,
        id: prod.id,
        images: prod.images,
        desc: prod.description,
        default_price: prod.default_price
      }
    }))

    console.log(JSON.stringify(prices,null,2))*/

    return {}
  }

  async pushBillableService(devId, remote, billableService){
    
    let client = new Dataparty.EphemeralClient({
      identity: devId,
      urlOrParty: remote.url,
      wsUrlOrParty: remote.ws,
      allowSelfSigned: remote.allowSelfSigned
    })

    await client.start()


    let uploadResult = await client.restParty.comms.call('billable/create', {service: billableService}, {
      expectClearTextReply: false,
      sendClearTextRequest: false,
      useSessions: true
    })

    console.log('result', uploadResult)


    let priceInfo = await client.restParty.comms.call('billing/product/info', {service: billableService.identity}, {
      expectClearTextReply: false,
      sendClearTextRequest: false,
      useSessions: true
    })

    console.log('priceInfo', priceInfo)
  }
}

module.exports = VenueBillableServiceCreate


