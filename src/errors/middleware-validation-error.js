module.exports = class MiddlewareValidationError extends Error{
  constructor(err, parsed){
    super(err.toString())

    this.name = 'ValidationError'
    this.parsed = parsed
  }
}