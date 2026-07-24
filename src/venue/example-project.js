module.exports = {
      owner: 'null',
      name: 'example-project',
      version: '1.0',

      venue: 'dataparty-venue',
      domain: 'api.dataparty.xyz',

      hosting: {
        http:{
          listenUri: 'https://0.0.0.0:3000',
          trust_proxy: false,
          generateSSLKey: true
        }
      },

      party: [{
        name: 'main',
        db: 'tingo',
        key: {
          generateKey: true
        },
        settings: {
          noCache: true
        }
      }],

      routes: [{
        prefix: '/api',
        party:'main',
        staticPath: 'public/',
        package: {
          name: '@dataparty/api'
        },
        settings: {
          sendFullErrors: false,
          useNative: false
        }
      }],
      files: [
        'public/*',
        'public/dist/dataparty-browser.*',
        'public/node_modules/argon2-browser/dist/*'
      ]
    }