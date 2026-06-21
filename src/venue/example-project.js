module.exports = {
      owner: 'null',
      name: 'example-project',
      version: '1.0',

      venue: 'dataparty-venue',
      domain: 'api.dataparty.xyz',

      routes: [{
        prefix: '/api',
        party:'SYSTEM',
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