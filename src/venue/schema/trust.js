{
  owner: [User | Host],
  from: Identity,
  target: {
    id: String,
    type: String,
    hash: {
      value: String,
      order: String[]
    }
    host: Identity, `Index`
  }

}