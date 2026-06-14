const CmdTree = require('command-tree')
const Hoek = require('@hapi/hoek')
const debug = require('debug')('venue.project-build')
const Path = require('path')
const OS = require('os')
const fs = require('fs')
const mkdirp = require('mkdirp')

const prompt = require('prompt')
const argon2 = require('argon2')

const { execSync } = require('child_process')

const {
  globSync
} = require('glob')
const tar = require('tar')


const Dataparty = require('../../../../')
const dataparty_crypto = require('@dataparty/crypto')
const Joi = require('joi')

const {Routines} = dataparty_crypto

const DEFINITION = {
  h: {
    description: 'Show help',
    alias: 'help',
    type: 'help'
  },
  o: {
    alias: 'output',
    type: 'string',
    default: Path.join(process.cwd(), 'dist/')
  },
  nopassword: {
    type: 'boolean',
    default: false
  },
  identity: {
    type: 'string',
    description: 'developer release identity',
    require: true
  },
  name: {
    description: 'project name'
  },
  version: {
    description: 'project version'
  },
  remote: {
    type: 'string',
    description: 'name of remote to build project for'
  },
  deploy: {
    type: 'boolean',
    default: false
  }
}


async function compressFiles(projectName, root, fileList, outputPath, writeFile){

  if(!fileList){ return }

  let fileMap={}

  let files = fileList.map(file=>{
    //
    const content = fs.readFileSync(file)
    const hash = dataparty_crypto.Routines.Utils.base64.encode(
      dataparty_crypto.Routines.Utils.hash(content)
    )

    fileMap[file] = { hash, size: content.length }

    return hash
  })

  if(!files || files.length < 1){ return }

  const tarFileName = projectName.replace('/', '-')+'.project.files.venue.tgz'
  const tarPath = Path.join(outputPath, tarFileName)

  await tar.create({
    cwd: root,
    gzip: true,
    file: tarPath
  }, fileList)

  const staticTar = fs.readFileSync(tarPath)

  let tarHash = dataparty_crypto.Routines.Utils.hash( staticTar )
  let tarHash64 = dataparty_crypto.Routines.Utils.base64.encode(tarHash)

  const fileInfo = {
    [tarFileName]: {
      tar: tarFileName,
      hash:tarHash64,
      size: staticTar.length,
      files: fileMap
    }
  }

  return {tarPath, files: fileInfo}
}


class VenueProjectBuild extends CmdTree.Command {
  constructor(context){
    super({...VenueProjectBuild.Definition, context})
    debug('constructor')

    this.project = {}
    this.project_sources = []
  }
  
  static get Command(){
    return 'project build'
  }
  
  static get Definition(){
    return {
      usage: `venue project build [project.json]`,
      description: 'Build a project',
      definition: DEFINITION
    }
  }
  
  async run({parsed}){
    //debug('context -', this.context)
    //console.log('parsed -', parsed)
    
    if (parsed.h) {
      throw new CmdTree.Error.HelpRequest('help request')
    }

    if (parsed._.length != 3){
      throw new CmdTree.Error.UsageError('You must supply project json/js')
    }

    const keyName = parsed.identity

    const phrase = await this.context.secureConfig.read('identity.'+keyName+'.phrase')

    if(!phrase){
      throw new CmdTree.Error.UsageError("Key doesn't exist!")
    }

    const {password} = parsed.nopassword ? {password:null} : await prompt.get({
            properties: {
                password: {
                    message: 'Enter password for identity['+keyName+']',
                    hidden: true
            }
        }})

    let key = await dataparty_crypto.Identity.fromMnemonic(phrase, password, argon2)

    key.id = keyName

    const projectJsonPath =  Path.resolve(parsed._[2])

    /*let foundUp = findUp('package.json', Path.dirname(serviceClassPath))

    let pkgJson = foundUp.content*/

    let projectJson = require( projectJsonPath )

    
    const remoteName = parsed.remote || projectJson.venue
    const remote = await this.context.secureConfig.read('remote.'+remoteName)

    if(!remote){
      throw new CmdTree.Error.UsageError('Invalid remote ['+remoteName+']')
    }

    const project = {
      owner: key.key.hash,
      created: Date.now(),

      name: parsed.name ? parsed.name : projectJson.name,
      version: parsed.version ? parsed.version : projectJson.version,

      venue: remote.identity.key.hash,
      domain: projectJson.domain,

      i2p: projectJson.i2p,
      party: projectJson.party,
      routes: projectJson.routes,
      files: projectJson.files

    }

    await mkdirp(parsed.output)

    const buildOutput = parsed.output+'/'+ project.name.replace('/', '-') +'.project.venue.json'

    let prjFiles = []
    prjFiles.push(buildOutput)

    if(project.files){
      this.addProjectFiles(
        Path.dirname(projectJsonPath),
        projectJson.files,
        { nodir: true, follow: true }
      )

      const {tarPath, files} = await compressFiles(project.name,Path.dirname(projectJsonPath), this.project_sources.files, parsed.output, true)
      
      project.files = files

      if(tarPath){prjFiles.push(tarPath)}

      
    }

    const ownerSig = await key.sign( project, true )

    project.signatures = {
      [key.key.hash]: dataparty_crypto.Routines.Utils.base64.encode(ownerSig.sig)
    }
    
    fs.writeFileSync(buildOutput, JSON.stringify(project, null,2))

    let staticTar = undefined
    
    if(prjFiles.length == 3){
      staticTar = fs.readFileSync(prjFiles[ prjFiles.length - 1 ])
    }

    await this.pushProject(key, remote, project, staticTar)

    return {files: prjFiles, project}
  }


  addProjectFiles(root, pattern, options){

    let result = globSync(pattern, {
      dotRelative: true,
      cwd:root,
      ...options
    })

    if(!this.project_sources.files){
      this.project_sources.files = result
    } else {
      this.project_sources.files = this.project_sources.files.concat(result)
    }
    
    this.project_sources.files_root = root

    debug('addFiles',result)

  }

  async pushProject(devId, remote, build, staticTar){
  
      let client = new Dataparty.EphemeralClient({
        identity: devId,
        urlOrParty: remote.url,
        wsUrlOrParty: remote.ws
      })
  
      await client.start()
  
  
      let uploadResult = await client.restParty.comms.call('create-project', {project:build, staticTar}, {
        expectClearTextReply: false,
        sendClearTextRequest: false,
        useSessions: true
      })
  
      console.log('result', uploadResult)
    }
}

module.exports = VenueProjectBuild


