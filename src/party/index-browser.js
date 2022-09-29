const IParty = require('./iparty')
const PeerParty = require('./peer/peer-party')
const CloudParty = require('./cloud/cloud-party')
const LokiParty = require('./local/loki-party')
const ZangoParty = null//require('./local/zango-party')

const IDocument = require('./idocument')
const DocumentFactory = require('./document-factory')
const CloudDocument = require('./cloud/cloud-document')

const LokiDb = require('../bouncer/db/loki-db')

module.exports = {
  IDocument, IParty, DocumentFactory,
  CloudDocument,
  CloudParty, LokiParty, ZangoParty, PeerParty,
  LokiDb
}
