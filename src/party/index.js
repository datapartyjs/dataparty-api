const IParty = require('./iparty')
const PeerParty = require('./peer/peer-party')
const CloudParty = require('./cloud/cloud-party')
const LokiParty = require('./local/loki-party')
const TingoParty = require('./local/tingo-party')
const MongoParty = require('./mongo/mongo-party')

const IDocument = require('./idocument')
const DocumentFactory = require('./document-factory')
const CloudDocument = require('./cloud/cloud-document')

const LokiDb = require('./local/loki-db')

module.exports = {
  IDocument, IParty, DocumentFactory,
  CloudDocument,
  CloudParty, LokiParty, PeerParty, MongoParty,
  LokiDb, TingoParty
}