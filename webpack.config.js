const HtmlWebpackPlugin = require('html-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const path = require('path')
const webpack = require('webpack')

module.exports = (env, options) => {
  return {
    entry: './src/webchat.js',
    output: {
      filename: 'webchat.[contenthash].js',
      path: path.resolve(__dirname, 'static')
    },
    optimization: {
      minimize: options.mode === 'production'
    },
    plugins: [
      new MiniCssExtractPlugin({
        filename: 'webchat.[contenthash].css'
      }),
      new HtmlWebpackPlugin({
        template: 'src/index.html'
      }),
      new webpack.ProvidePlugin({
        $: 'jquery',
        jQuery: 'jquery'
      })
    ],
    module: {
      rules: [
        {
          test: /\.(sa|sc|c)ss$/,
          use: [
            MiniCssExtractPlugin.loader,
            'css-loader',
            'sass-loader'
          ]
        },
        {
          test: /\.(woff(2)?|ttf|eot|svg)$/,
          use: [
            {
              loader: 'file-loader',
              options: {
                name: '[name].[contenthash:20].[ext]',
                esModule: false
              }
            }
          ]
        },
        {
          test: /\.(ico|png)$/,
          use: [
            {
              loader: 'file-loader',
              options: {
                name: '[name].[ext]',
                esModule: false
              }
            }
          ]
        },
        {
          test: /\.(html)$/,
          use: {
            loader: 'html-loader',
            options: {
              minimize: options.mode === 'production'
            }
          }
        }
      ]
    }
  }
}
