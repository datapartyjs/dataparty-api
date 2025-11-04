const debug = require('debug')('dataparty.op.auth-op')
const SocketOp = require('./socket-op')

const {Routines, AESStream} = require('@dataparty/crypto')


class AuthOp extends SocketOp {
  constructor(socket){
    super('auth', {}, socket)

    this.offer=null
    this.stream=null
  }

  async run(){
    const actor = this.socket.party.privateIdentity
    this.stream = await AESStream.createStream( actor, this.socket.remoteIdentity, true, 'random' )
    const aesStreamOffer = this.stream.offer
    

    const offer = {
      sender: {
        id: aesStreamOffer.sender.key.id,
        key: {
          type: aesStreamOffer.sender.key.type,
          hash: aesStreamOffer.sender.key.hash,
          public: aesStreamOffer.sender.key.public
        }
      },
      pqCipherText: aesStreamOffer.pqCipherText,
      streamNonce: aesStreamOffer.streamNonce,
      mode: aesStreamOffer.mode
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