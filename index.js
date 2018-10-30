/*
* Application entry 
* 
**/

//dependencies
const server = require('./lib/server')

// Declare app
const app = {}

// Init function
app.init = () => {
  // Init server
  server.init()
}

// Execute
app.init()

// Export app
module.exports = app