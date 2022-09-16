'use strict';
const reach = require('./reach')

// variables for vapor mongoose schema validation

exports.ipv4Re = [
  /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  'ipv4 string format -> \'0.0.0.0\'',
]
exports.maxPath = 256
exports.pathRe = [
  /^\/[\w/-]*$/,
  'global path format -> \'/path/to/resource-0\'',
]
exports.maxUri = 256
exports.uriRe = [
  /^[a-zA-Z]+:\/\/[\w.\-_/:]+$/,
  'uri format -> \'http://ip-or-host:1234/path\'',
]
exports.maxPackage = 256
exports.packageRe = [
  /^\w+\/\w+$/,
  'package type format -> \'std_msgs/String\'',
]

// variables for api mongoose schema validation

exports.name = { type: String, maxlength: 50, minlength: 3}

exports.string = function(maxlength, minlength){
  return { type: String, maxlength: maxlength, minlength: minlength || 3}
}

exports.url = {
  type: String
  //match: exports.uriRe
}

exports.created = {
  type: Date,
  default: Date.now,
  required: true
}

exports.actor = function(types){
  let defaultVal = undefined
  if(!Array.isArray(types)){
    types = [types]
    defaultVal = types
  }
  
  return {
    id: String,
    type: {
      enum: types,
      type: String,
      default: defaultVal,
      meta: {docRef: types}
    }
  }
}

exports.doc = exports.actor

exports.metadataValue = function(doc,key){
  for(let obj of doc.metadata){
    if(obj.key == key){return obj.value}
  }

  return undefined
}


