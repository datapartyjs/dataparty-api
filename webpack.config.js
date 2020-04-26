'use strict'

const path = require('path')
const webpack = require('webpack')
var nodeExternals = require('webpack-node-externals')

var browser_config = {
  mode: 'production',
  entry: {
    '@roshub/api': './src/index.js'
  },
  devtool: 'cheap-module-source-map',
  output: {
    library: ['RosHub'],
    libraryTarget: 'var',
    path: path.join(__dirname, 'dist'),
    filename: 'roshub-browser.js'
  },
  node: {
    fs: 'empty',
    net: 'empty',
    dns: 'empty'
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.ENV': JSON.stringify('browser')
    })
  ]
}
var node_config = {
  target: 'node',
  externals: [nodeExternals({
    whitelist: ["@roshub_backend/model", "@roshub_backend/roshub-crypto", "@roshub_backend/model/dist/roshub-model.json"
  ],
    modulesFromFile: true
  })],
  mode: 'development',
  entry: {
    '@roshub/api': './src/node-roshub.js'
  },
  devtool: 'cheap-module-source-map',
  output: {
    library: "",
    libraryTarget: 'commonjs',
    path: path.join(__dirname, 'dist'),
    filename: 'roshub-node.js'
  },
  resolve: {
    modules: [
      'node_modules',
    ],
    extensions: ['.ts', '.tsx', '.js', '.json'],
    symlinks: true,
  }
}

module.exports = [
  browser_config, 
  node_config]
