/*
* Author: John Meresey
* Server related tasks
**/

//dependencies
const http = require('http');
const https = require('https')
const fs = require('fs')
const path = require('path')
const url = require('url');
const { StringDecoder } = require('string_decoder');
const util = require('util')

const config = require('./config');
const handlers = require('./handlers')
const helpers = require('./helpers')
const debug = util.debuglog('server')

// Declare server module object
const server = {}

//instantiate http server
server.httpServer = http.createServer((req, res) => {
  server.unifiedServer(req, res)
})

//instantiate https server
server.httpsServerOptions = {
  'key': fs.readFileSync(path.join(__dirname, '../', 'https/key.pem')),
  'cert': fs.readFileSync(path.join(__dirname, '../', 'https/cert.pem'))
}
server.httpsServer = https.createServer(server.httpsServerOptions, (req, res) => {
  server.unifiedServer(req, res)
})

server.router = {
  ping: handlers.ping,
  users: handlers.users,
  login: handlers.login,
  logout: handlers.logout,
  menu: handlers.menu,
  shoppingcart: handlers.shoppingcart,
  checkout: handlers.checkout
}

//unified server logic
server.unifiedServer = (req, res) => {
  //get the URL and parse it
  const parsedURL = url.parse(req.url, true)

  //get the path
  const path = parsedURL.pathname
  const trimmedPath = path.replace(/^\/+|\/+$/g, '')

  //get query string object
  const queryStringObject = parsedURL.query

  //get request method
  const method = req.method.toLowerCase()

  //get request headers
  const headers = req.headers

  //get the payload
  const decoder = new StringDecoder('utf-8')
  let buffer = ''
  req.on('data', data => {
    buffer += decoder.write(data)
  })
  req.on('end', () => {
    buffer += decoder.end()

    //choose handler for this request
    const chosenHandler = typeof (server.router[trimmedPath]) !== 'undefined' ? server.router[trimmedPath] : handlers.notFound;
    const data = {
      trimmedPath,
      queryStringObject,
      headers,
      method,
      payload: helpers.parseToJSON(buffer)
    }

    //route the request to the chosen handler
    chosenHandler(data, (statuscode = 200, payload = {}) => {
      //convert payload to string
      const payloadString = JSON.stringify(payload)
      
      //send response
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(statuscode)
      res.end(payloadString)
      //log the request path
      if (statuscode == 200) {
        debug('\x1b[32m%s\x1b[0m', `${method.toUpperCase()} /${trimmedPath} ${statuscode}`)
      } else {
        debug('\x1b[31m%s\x1b[0m', `${method.toUpperCase()} /${trimmedPath} ${statuscode}`)
      }
    })

  })
}

// Init function
server.init = () => {
  // start http server
  server.httpServer.listen(config.httpPort, () => {
    console.log('\x1b[35m%s\x1b[0m', `Server is now listening on port ${config.httpPort}. Environemnt name is ${config.envname}`)
  })
  // start https server
  server.httpsServer.listen(config.httpsPort, () => {
    console.log('\x1b[35m%s\x1b[0m', `Server is now listening on port ${config.httpsPort}. Environemnt name is ${config.envname}`)
  })
}

// Export module
module.exports = server