const EventEmitter = require('eventemitter3')

const debug = require('debug')('dataparty.billing-client')
const EphemeralClient = require('./ephemeral-client')

class BillingClient extends EventEmitter {

  /**
   * Constructor
   * @param EphemeralClient client 
   */
  constructor(identity, domain='buy.dataparty.xyz', clientOptions={}){

    super()
    
    this.client = new EphemeralClient({
      identity,
      urlOrParty: 'https://'+domain,
      wsUrlOrParty: 'wss://'+domain+'/ws',
      ...clientOptions
    })
  }

  async start(){
    await this.client.start()
  }


  async getProductInfo(service){
    const reqData = {
      service
    }

    debug('getProductInfo', reqData)

    const result = await this.client.restParty.comms.call('billing/product/info', reqData, {
      expectClearTextReply: false,
      sendClearTextRequest: false,
      useSessions: true
    })

    debug('\tresult', result)

    return result.products
  }

  async createPaymentSession(service, productIndex=0, priceIndex=0, payment_type='stripe'){
    const reqData = {
      service,
      productIndex,
      priceIndex,
      payment_type
    }

    debug('createPaymentSession', reqData)

    const result = await this.client.restParty.comms.call('billing/create/payment', reqData, {
      expectClearTextReply: false,
      sendClearTextRequest: false,
      useSessions: true
    })

    debug('\tresult', result)

    return result.payment_session
  }

}

module.exports = BillingClient
