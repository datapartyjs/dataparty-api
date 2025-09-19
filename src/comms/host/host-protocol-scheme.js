const Joi = require('joi')
Joi.objectId = require('joi-objectid')(Joi)

const ID_SCHEME = Joi.alternatives().try(Joi.string(), Joi.number())

const OP_HEADER = Joi.object().keys({
  id: ID_SCHEME.required(),
  op: Joi.string().valid(
    'auth',
    'peer-call',
    'advertise',
    'subscribe',
    'unsubscribe',
    'publish'
  ).required()
})


const AUTH_OP = Joi.object().keys({
  id: ID_SCHEME.required(),
  op: Joi.string().valid('auth').required(),
  session: Joi.string().required(),
  offer: Joi.object().keys({
    sender: Joi.object().keys({
      id: Joi.string(),
      key: Joi.object().keys({
        type: Joi.string().required(),
        hash: Joi.string().required(),
        public: Joi.object().keys({
          box: Joi.string().required(),
          sign: Joi.string().required(),
          pqkem: Joi.string().required(),
          pqsign_ml: Joi.string().required(),
          pqsign_slh: Joi.string().required()
        }).required()
      }).required(),
      seed: Joi.allow(null)
    }).required(),
    pqCipherText: Joi.string().required(),
    streamNonce: Joi.string().required()
  }).required(),
  signature: Joi.object().keys({
    timestamp: Joi.number().required(),
    type: Joi.string().required(),
    value: Joi.string().required()
  }).required()
})

const CALL_OP = Joi.object().keys({
  id: ID_SCHEME.required(),
  op: Joi.string().valid('peer-call').required(),
  session: Joi.string(), //Joi.objectId(),
  endpoint: Joi.string(),
  data: Joi.object()
})

const ADVERTISE_OP = Joi.object().keys({
  id: ID_SCHEME.required(),
  op: Joi.string().valid('advertise').required(),
  type: Joi.string().required(),
  topic: Joi.string().required(),
  queue_size: Joi.number(),
  latch: Joi.boolean()
})

const UNADVERTISE_OP = Joi.object().keys({
  id: ID_SCHEME.required(),
  op: Joi.string().valid('unadvertise').required(),
  topic: Joi.string().required()
})


const SUBSCRIBE_OP = Joi.object().keys({
  id: ID_SCHEME.required(),
  op: Joi.string().valid('subscribe').required(),
  type: Joi.string(),//.required(),
  topic: Joi.string().required(),
  compression: Joi.string(),
  queue_length: Joi.number(),
  throttle_rate: Joi.number()
})

const UNSUBSCRIBE_OP = Joi.object().keys({
  id: ID_SCHEME.required(),
  op: Joi.string().valid('unsubscribe').required(),
  topic: Joi.string().required()
})

const PUBLISH_OP = Joi.object().keys({
  id: ID_SCHEME.required(),
  op: Joi.string().valid('publish').required(),
  topic: Joi.string().required(),
  latch: Joi.boolean(),
  msg: Joi.any()
})


const ANY_OP = Joi.alternatives().try(
  ADVERTISE_OP,
  UNADVERTISE_OP,
  SUBSCRIBE_OP,
  UNSUBSCRIBE_OP,
  PUBLISH_OP,
  CALL_OP
)

module.exports = {
  'OP_HEADER': OP_HEADER,
  'AUTH_OP': AUTH_OP,
  'ADVERTISE_OP': ADVERTISE_OP,
  'UNADVERTISE_OP': UNADVERTISE_OP,
  'SUBSCRIBE_OP': SUBSCRIBE_OP,
  'UNSUBSCRIBE_OP': UNSUBSCRIBE_OP,
  'PUBLISH_OP': PUBLISH_OP,
  'PEER_CALL_OP': CALL_OP,
  'ANY_OP': ANY_OP
}
