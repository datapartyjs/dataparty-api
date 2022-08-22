const IParty = require('./iparty')
const PeerParty = require('./peer/peer-party')
const CloudParty = require('./cloud/cloud-party')
const LokiParty = require('./local/loki-party')
const TingoParty = require('./local/tingo-party')
const MongoParty = require('./mongo/mongo-party')

const IDocument = require('./idocument')
const DocumentFactory = require('./document-factory')
const CloudDocument = require('./cloud/cloud-document')

module.exports = {
  IDocument, IParty, DocumentFactory,
  CloudDocument,
  CloudParty, LokiParty, PeerParty, MongoParty,
  TingoParty
}