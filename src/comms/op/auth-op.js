const debug = require('debug')('dataparty.op.auth-op')
const SocketOp = require('./socket-op')

const {Routines} = require('@dataparty/crypto')


class AuthOp extends SocketOp {
  constructor(socket){
    super('auth', {}, socket)

    this.offer=null
    this.stream=null
  }

  async run(){
    const actor = this.socket.party.privateIdentity
    const aesStreamOffer = await actor.createStream( this.socket.remoteIdentity )

    this.stream = aesStreamOffer.stream

    const offer = {
      sender: aesStreamOffer.sender,
      pqCipherText: aesStreamOffer.pqCipherText,
      streamNonce: aesStreamOffer.streamNonce
    }

    const offerBSON = Routines.BSON.serializeBSONWithoutOptimiser( offer )

    const { timestamp, value, type } = await Routines.signDataPQ(actor, offerBSON, 'pqsign_ml')

    const authPkt = {
      offer,
      signature: {
        timestamp, type,
        value: Routines.Utils.base64.encode(value)
      }
    }

    debug('created authPkt', authPkt)

    this.offer = offer
    this.data = authPkt

    return super.run()
  }
}

module.exports = AuthOp