module.exports = class DocumentValidationError extends Error {
  constructor(ajvErrors){
    super()

    /*[
        {
          "keyword": "required",
          "dataPath": "",
          "schemaPath": "#/required",
          "params": {
            "missingProperty": "name"
          },
          "message": "should have required property 'name'"
        }
      ]
    */

    this.message='Validation failure\n'

    for(let i=0; i<ajvErrors.length; i++){
      const error = ajvErrors[i]
      this.message += error.message + 'at data.'+error.dataPath
    }

    this.stack=''
    this.name='DocumentValidationError'
    this.code=this.name
  }
}