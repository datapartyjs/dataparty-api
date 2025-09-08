
const argon2 = require('argon2')

const Dataparty = require('../src/index')

const prompt = require('prompt')

let secureConfig = null

const HELP_INFO = `
  help
  get
  set
  lock
  unlock
  id
  exit
`

async function main(){
    const memoryConfig = new Dataparty.Config.MemoryConfig({foo: 'bar'})


    const jsonConfig = new Dataparty.Config.JsonFileConfig({
        basePath: '/tmp'
    })


    secureConfig = new Dataparty.Config.SecureConfig({
        config: jsonConfig,
        timeoutMs: 60*1000,
        argon: argon2
    })

    
    secureConfig.on('locked', async ()=>{
        console.log('locked')

        /*
        while(secureConfig.isLocked()){
            const {password} = await prompt.get({
                properties: {
                    password: {
                        message: 'Enter password',
                        hidden: true
                }
            }})
    

            try{
                await secureConfig.unlock(password)
            }
            catch(err){
                console.log('bad password')
            }
        }
        */
    })

    

    secureConfig.on('timeout', ()=>{ console.log('timeout') })

    secureConfig.on('ready', async ()=>{ 
        console.log('ready')

        //console.log('config', await secureConfig.readAll())
    })

    let blocked = false

    secureConfig.on('blocked', async (reason)=>{

        if(await secureConfig.isInitialized() && secureConfig.isLocked()){

            if(blocked){
                console.log('blocked true')
                await secureConfig.waitForUnlocked()
                return
            }

            blocked = true
            console.log('blocked -',reason)


            const {password} = await prompt.get({
                properties: {
                    password: {
                        message: 'Enter password',
                        hidden: true
                }
            }})

            await secureConfig.unlock(password)

            blocked = false
        }
        
    
    })

    secureConfig.on('unlocked', async ()=>{ 
        console.log('unlocked')

        await secureConfig.write('timestamp', Date.now())

    })

    secureConfig.on('setup-required', async ()=>{
        
        console.log('setup-required')

        let password = ''

        while(1){
            let passes = await prompt.get({
                properties: {
                    password1: {
                        message: 'Set password',
                        hidden: true
                    },
                    password2: {
                        message: 'Confim password',
                        hidden: true
                    }
                }
            })

            if(passes.password1 == passes.password2){

                password = passes.password1
                break
            }

            console.log("passwords don't match")
        }

        await secureConfig.setPassword(password, {
            foo: 'bar'
        })

        console.log('password set')


        await secureConfig.unlock(password)

    })

    console.log('starting')

    await secureConfig.start()

    console.log('wait for startup')

    await secureConfig.waitForUnlocked('startup')

    console.log('wait over')

    //console.log('main config', await secureConfig.readAll())

    while(1){

        const {cmd} = await prompt.get({
            properties: {
                cmd: {
                    message: 'command >'
            }
        }})
    
        if(cmd && cmd.length > 0){
            let parts = cmd.split(' ')
    
            switch(parts[0]){
                case 'help':
                    console.log(HELP_INFO)
                    break
                case 'lock':
                    secureConfig.lock()
                    break
                case 'get':
                    if(parts.length == 1){
                        let value = await secureConfig.readAll()
                        console.log(value)
                    } else {
                        let value = await secureConfig.read(parts[1])
                        console.log(parts[1], '=', value)
                    }
                    break
                case 'set':
                    await secureConfig.write(parts[1], parts[2])
                    console.log(parts[1], '=', parts[2])
                    break
                case 'id':
                   console.log(secureConfig.identity.toMini())
                   break
                case 'quit':
                case 'exit':
                    process.exit(0)
                default:
                    console.log('unknown command [',cmd,']')
                    break
            }
        }
    }


    /*let timer = setTimeout(async ()=>{

        console.log('timer config', await secureConfig.readAll())

    }, 1000*30)*/

}

main().catch((err)=>{
    console.error('crashed', err)  
}).then(()=>{
    console.log('done')
})
