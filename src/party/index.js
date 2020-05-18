const IParty = require('./iparty')
const CloudParty = require('./cloud/cloud-party')
const LocalParty = require('./local/local-party')

const IDocument = require('./idocument')
const DocumentFactory = require('./document-factory')
const CloudDocument = require('./cloud/cloud-document')
const LocalDocument = require('./local/local-document')

const LokiDb = require('./local/loki-db')

module.exports = {
  IDocument, IParty, DocumentFactory,
  CloudDocument, LocalDocument,
  CloudParty, LocalParty,
  LokiDb
}