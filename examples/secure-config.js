
const Dataparty = require('../src/index')

const prompt = require('prompt')


async function main(){
    const memoryConfig = new Dataparty.Config.MemoryConfig({foo: 'bar'})


    const jsonConfig = new Dataparty.Config.JsonFileConfig({
        basePath: '/tmp'
    })


    const secureConfig = new Dataparty.Config.SecureConfig({
        config: memoryConfig
    })

    
    secureConfig.on('locked', ()=>{ console.log('locked') })

    secureConfig.on('unlocked', async ()=>{ 
        console.log('unlocked')

        await secureConfig.write('timestamp', Date.now())
    })

    secureConfig.on('timeout', ()=>{ console.log('timeout') })

    secureConfig.on('ready', async ()=>{ 
        console.log('ready')

        console.log('config', await secureConfig.readAll())
    })

    let blocked = false

    secureConfig.on('blocked', async (reason)=>{

        if(await secureConfig.isInitialized() && secureConfig.isLocked()){

            if(blocked){
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

        secureConfig.setPassword(password, {
            foo: 'bar'
        })

    })

    await secureConfig.start()

    await secureConfig.waitForUnlocked('startup')

    console.log('wait over')

    console.log('main config', await secureConfig.readAll())

    setTimeout(async ()=>{


        console.log('timer config', await secureConfig.readAll())

    }, 30000)

    //process.exit()
}

main().catch((err)=>{
    console.error('crashed', err)  
}).then(()=>{
    console.log('done')
})


/*
setTimeout(function () {
    process.exit();
}, 5000);*/