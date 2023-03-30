{
  uuid: String,
  created: Date,
  owner: Admin | User | Self,
  type: [ 'Admin', 'User', 'Party' ],  //! type of account that can be created
  claimedBy: [Admin[], User[]],
  anyoneWithLink: Boolean,
  sendToEmail: String,
  localhostOnly: Boolean //! true = only allow invite claim over localhost
}