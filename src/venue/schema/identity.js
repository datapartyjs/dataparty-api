{
  created: Date,
  owner: [User | Party]

  type: [Nacl],
  value: Object,
  
  hash: String,
  service: ServiceString,
  
  isAccountKey: Boolean //! Must be trusted by an actor root key
}


// computing hashes
//require('crypto').createHash('sha1').update('abc').digest('hex')
