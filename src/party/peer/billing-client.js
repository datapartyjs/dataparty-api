const EventEmitter = require('eventemitter3')

const debug = require('debug')('dataparty.billing-client')


class BillingClient extends EventEmitter {


  /**
   * Constructor
   * @param EphemeralClient client 
   */
  constructor(client){

    super()
    
    this.client = client
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

  async createPaymentSession(service, productIndex, priceIndex, payment_type='stripe'){
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
