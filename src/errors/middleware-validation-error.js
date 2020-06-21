module.exports = class MiddlewareValidationError extends Error{
  constructor(err, parsed){
    super(err.toString())

    this.name = 'MiddlewareValidationError'
    this.parsed = parsed
  }
}