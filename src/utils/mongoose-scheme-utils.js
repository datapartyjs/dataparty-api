'use strict';
const reach = require('./reach')
const BouncerDb = require('@dataparty/bouncer-db')
const mongoose = BouncerDb.mongoose()


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
    id: {type: mongoose.Schema.ObjectId},
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

exports.profile = {
  fullname: exports.name,
  photo: { type: String, maxlength: 500, description: 'user photo url' },
  created: exports.created,
  bio: exports.string(450),
  email: exports.string(100),
  description: exports.string(250),
  company: exports.string(100),
  location: exports.string(100),
  social: {
    twitter: exports.string(100),
    linkedin: exports.string(100),
    github: exports.string(100),
  }
}


exports.objRef = function(doc, subpath=undefined, options={}){
  let idPath = 'id'
  let typePath = 'type'

  if(subpath!==undefined){
    idPath = subpath+'.id'
    typePath = subpath+'.type'
  }

  let id = reach(doc, idPath) 

  if(typeof id !== 'object'){ id = new mongoose.Types.ObjectId(id) }

  return {
    id: id,
    type: reach(doc, typePath) || options.type
  }
}