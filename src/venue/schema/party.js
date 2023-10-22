
{
  created: Date,
  address: String,
  identity: {
    type: [NaCl]
    hash: String
  },
  rootOfTrust: {

    nacl: NaClIdentityObject[],
    wallet: WalletIdentityObject[],
    pgp: String[]
  }
  unlisted: Boolean
  private: Boolean //! Only show to people who party.identity has trusted
  type: ['External', 'SharedHost', 'ContainerHost', 'Internal']
}
