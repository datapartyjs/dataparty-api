
const Dataparty = require('../src/index')

const prompt = require('prompt')


async function main(){
    //const memoryConfig = new Dataparty.Config.MemoryConfig({foo: 'bar'})


    const jsonConfig = new Dataparty.Config.JsonFileConfig({
        foo: 'bar',
        basePath: '/tmp'
    })


    const secureConfig = new Dataparty.Config.SecureConfig({
        config: jsonConfig
    })

    
    secureConfig.on('locked', ()=>{ console.log('locked') })

    secureConfig.on('unlocked', ()=>{ console.log('unlocked') })

    secureConfig.on('timeout', ()=>{ console.log('timeout') })

    secureConfig.on('ready', ()=>{ console.log('ready') })

    secureConfig.on('blocked', async (reason)=>{

        if(await secureConfig.isInitialized() && secureConfig.isLocked()){

            

            console.log('blocked -',reason)

            const {password} = await prompt.get({
                properties: {
                    password: {
                        message: 'Enter password',
                        hidden: true
                }
            }})

            secureConfig.unlock(password)
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

        secureConfig.setPassword(password)

    })

    await secureConfig.start()

    await secureConfig.waitForUnlocked('startup')

    console.log('wait over')

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