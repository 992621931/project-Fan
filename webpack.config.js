const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  
  // Get version information from environment variables
  const version = process.env.VITE_VERSION || 'dev';
  const buildTime = process.env.VITE_BUILD_TIME || new Date().toISOString();
  const commit = process.env.VITE_COMMIT || 'unknown';
  const branch = process.env.GITHUB_REF_NAME || 'development';
  
  return {
    entry: './src/index.ts',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isProduction ? '[name].[contenthash].js' : '[name].js',
      clean: true,
      publicPath: isProduction ? '/project-Fan/' : '/'
    },
    resolve: {
      extensions: ['.ts', '.js'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@/components': path.resolve(__dirname, 'src/components'),
        '@/systems': path.resolve(__dirname, 'src/systems'),
        '@/entities': path.resolve(__dirname, 'src/entities'),
        '@/types': path.resolve(__dirname, 'src/types'),
        '@/utils': path.resolve(__dirname, 'src/utils'),
        '@/config': path.resolve(__dirname, 'src/config')
      }
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: {
            loader: 'ts-loader',
            options: {
              transpileOnly: true, // Skip type checking for faster builds
              compilerOptions: {
                noEmit: false
              }
            }
          },
          exclude: /node_modules/
        },
        {
          test: /\.css$/i,
          use: ['style-loader', 'css-loader']
        },
        {
          test: /\.(png|svg|jpg|jpeg|gif)$/i,
          type: 'asset/resource'
        },
        {
          test: /\.(woff|woff2|eot|ttf|otf)$/i,
          type: 'asset/resource'
        }
      ]
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/index.html',
        title: '代号：饭 - Codename Rice Game',
        favicon: './src/assets/favicon.ico',
        templateParameters: {
          version,
          buildTime,
          commit,
          branch,
          environment: isProduction ? 'production' : 'development'
        }
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: 'images',
            to: 'images',
            noErrorOnMissing: true
          },
          {
            from: 'src/game/data',
            to: 'src/game/data',
            noErrorOnMissing: true,
            globOptions: {
              ignore: ['**/*.ts', '**/*.test.ts']
            }
          }
        ]
      }),
      new webpack.DefinePlugin({
        '__VERSION_INFO__': JSON.stringify({
          version,
          buildTime,
          commit,
          branch,
          environment: isProduction ? 'production' : 'development'
        }),
        'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development')
      }),
      ...(isProduction ? [
        new webpack.BannerPlugin({
          banner: `
代号：饭 (Codename Rice Game)
Version: ${version}
Build Time: ${buildTime}
Commit: ${commit}
Branch: ${branch}
Environment: production

Built with ❤️ using TypeScript and Webpack
          `.trim()
        })
      ] : [])
    ],
    devServer: {
      static: [
        {
          directory: path.join(__dirname, 'dist')
        },
        {
          directory: path.join(__dirname),
          publicPath: '/'
        }
      ],
      compress: true,
      port: 3000,
      hot: true,
      open: true,
      historyApiFallback: true
    },
    devtool: isProduction ? 'source-map' : 'eval-source-map',
    optimization: {
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all'
          }
        }
      }
    },
    stats: {
      assets: true,
      chunks: false,
      modules: false,
      colors: true,
      version: true,
      timings: true
    }
  };
};