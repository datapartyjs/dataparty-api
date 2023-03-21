{
  created: Date,

  uuid: String,

  rootOfTrust: {

    nacl: NaClIdentityObject[],
    wallet: WalletIdentityObject[]

    /*oauth: [{
      cloud: String,
      userId: String,
    }],
    email: String[],
    pgp: String[]*/
  }
}