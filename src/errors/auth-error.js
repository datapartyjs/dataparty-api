module.exports = class AuthError extends Error {
  constructor(message) {
    super(message)
    this.name = 'AuthError'
  }
}
