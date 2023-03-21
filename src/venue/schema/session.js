{
  uuid: String,
  host: Party,
  owner: [User | Party],
  identity: Identity,
  created: Date,
  expiry: Date,
  ws: Boolean,
  rest: Boolean,
  //rtc: Boolean
}