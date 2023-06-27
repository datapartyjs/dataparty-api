{
  owner: [User | Host],
  from: Identity,
  timestamp: Date,
  expiry: Date,
  target: {
    id: String,
    type: String,
    hash: String
    host: String //! Host identity hash
  }
}