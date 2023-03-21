
{
  created: Date,
  address: String,
  identity: {
    type: [NaCl]
    hash: String
  },
  unlisted: Boolean
  private: Boolean //! Only show to people who party.identity has trusted
  type: ['External', 'SharedHosted', 'Internal']
}
