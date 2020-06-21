'use strict'

const path = require('path')
const webpack = require('webpack')
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin

const CompressionPlugin = require('compression-webpack-plugin')

var nodeExternals = require('webpack-node-externals')

var browser_config = {
  mode: 'production',
  entry: {
    '@dataparty/api': './src/index-browser.js'
  },
  devtool: 'cheap-module-source-map',
  optimization: {
    minimize: true
  },
  output: {
    library: ['DataParty'],
    libraryTarget: 'var',
    path: path.join(__dirname, 'dist'),
    filename: 'dataparty-browser.js'
  },
  node: {
    fs: 'empty',
    net: 'empty',
    dns: 'empty',
    yargs: 'empty',
    readline: 'empty',
    child_process:'empty',
    '@dataparty/bouncer-db': 'empty'
  },
  plugins: [
    new CompressionPlugin(),
    new webpack.DefinePlugin({
      'process.env.ENV': JSON.stringify('browser')
    })/*,
    new BundleAnalyzerPlugin()*/
  ]
}


var node_config = {
  target: 'node',
  externals: [nodeExternals({
    whitelist: ["@dataparty/bouncer-model", "@dataparty/crypto",
  ],
    modulesFromFile: true
  })],
  mode: 'development',
  entry: {
    '@dataparty/api': './src/index.js'
  },
  devtool: 'cheap-module-source-map',
  output: {
    library: "",
    libraryTarget: 'commonjs',
    path: path.join(__dirname, 'dist'),
    filename: 'dataparty-node.js'
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
  //node_config
]
