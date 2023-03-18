{
  uuid: String,
  created: Date,
  owner: Admin | User | Self,
  type: [ 'Admin', 'User' ],
  claimedBy: [Admin[], User[]],
  anyoneWithLink: Boolean,
  sendToEmail: String,
  localHostOnly: Boolean //! true = only allow invite claim over localhost
}