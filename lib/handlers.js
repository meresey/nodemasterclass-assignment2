/*
* Route handlers for pizza delivery api
*
*/

// dependencies
const helpers = require('./helpers')
const _data = require('./data')
const config = require('./config')
const menu = require('../.data/menu/menu.json')


// Container to export the module
const handlers = {}

// Ping - GET
handlers.ping = (data, callback) => {
  callback(200)
}

// Not Found handler
handlers.notFound = (data, callback) => {
  callback(404)
}
// Users - (GET, POST, DELETE, PUT) Select appropriate handler for matching method
handlers.users = (data, callback) => {
  if (['post', 'delete', 'put'].indexOf(data.method) > -1) {
    handlers._users[data.method](data, callback)
  } else {
    callback(404)
  }
}

// Declare container to hold user's private mehtods
handlers._users = {}

// Users - POST
// Mandatory data: name, email address, street address, password
// Optinal: tokens
handlers._users.post = ({ payload }, callback) => {
  //validate data
  const name = typeof payload.name == 'string' && payload.name.trim().length > 0 ? payload.name.trim() : false
  const email = typeof payload.email == 'string' && payload.email.trim().length > 0 && payload.email.indexOf('@') > -1 ? payload.email.trim() : false
  const address = typeof payload.address == 'string' && payload.address.trim().length > 0 ? payload.address.trim() : false
  const password = typeof payload.password == 'string' && payload.password.trim().length > 0 ? payload.password.trim() : false

  // Proceed only if data is valid
  if (name && email && address && password) {
    // check if user exists
    _data.read('users', email, (err, data) => {
      if (data) return callback(400, { 'Error': `User with email ${email} already exists` })
      // hash password
      const hashedPassword = helpers.hash(password)
      // construct user object
      const user = {
        name,
        email,
        address,
        password: hashedPassword,
        tokens: []
      }
      // create user
      _data.create('users', email, user, err => {
        if (err) return callback(500, { 'Error': `Internal error. Unable to create user ${email}.` })
        callback(200, helpers.filterUserFields(user))
      })
    })

  } else {
    callback(400, { 'Error': 'Missing required fields' })
  }
}

// Users - PUT
// Mandatory fields: email
// optional fields: address, name, password

handlers._users.put = ({ payload, headers }, callback) => {
  // validate mandatory data
  const email = typeof payload.email == 'string' && payload.email.trim().length > 0 && payload.email.indexOf('@') > -1 ? payload.email.trim() : false
  // If no email address has been provided, return with 405
  if (!email) return callback(400, { 'Error': 'Email address is mandatory.' })

  // Proceed to validate optinal data
  const name = typeof payload.name == 'string' && payload.name.trim().length > 0 ? payload.name.trim() : false
  const address = typeof payload.address == 'string' && payload.address.trim().length > 0 ? payload.address.trim() : false
  const password = typeof payload.password == 'string' && payload.password.trim().length > 0 ? payload.password.trim() : false

  if (name || address || password) {
    // check that user has a valid token in header
    if (!headers.id) return callback(401)
    // check if token is valid for user 
    _data.read('users', email, (err, userData) => {
      if (err) return callback(500, { 'Error': 'Internal error. Unable to validate token' })
      if (!helpers.authenticate(userData.tokens, headers.id)) return callback(401, { 'Error': 'Invalid or expired token. Please log in' })
      // All clear proceed
      // Construct new user object
      const user = {
        name: name || userData.name,
        address: address || userData.address,
        password: password ? helpers.hash(password) : userData.password
      }
      const updatedUser = Object.assign({}, userData, user)
      // persist changes to disk
      _data.update('users', email, updatedUser, err => {
        if (err) return callback(500, { 'Error': 'Internal error, failed to update user details' })
        callback(200, helpers.filterUserFields(updatedUser))
      })
    })
  } else {
    callback(400, { 'Error': 'Missing fields to update' })
  }
}

// Users - DELETE
// Mandatory fields: email
// User must be authenticated
handlers._users.delete = ({ queryStringObject, headers }, callback) => {
  // validate mandatory data
  const email = typeof queryStringObject.email == 'string' && queryStringObject.email.trim().length > 0 && queryStringObject.email.indexOf('@') > -1 ? queryStringObject.email.trim() : false
  // If no email address has been provided, return with 405
  if (!email) return callback(405, { 'Error': 'Email address is mandatory.' })
  // check that user has a valid token in header
  if (!headers.id) return callback(401)
  // check if token is valid for user 
  _data.read('users', email, (err, userData) => {
    if (err) return callback(500, { 'Error': 'Internal error. Unable to validate token' })
    if (!helpers.authenticate(userData.tokens, headers.id)) return callback(401, { 'Error': 'Invalid or expired token. Please log in' })
    // All clear proceed
    // persist changes to disk
    // @TODO - delete user related data such as orders
    _data.delete('users', email, err => {
      if (err) return callback(500, { 'Error': 'Internal error, failed to delete user' })
      // Delete related orders
      callback(200)
    })
  })
}

// Login -POST
// Required data: email, password
handlers.login = ({ method, payload }, callback) => {
  // Proceed only if post method
  if (method.trim() !== 'post') return callback(405)

  // validate data
  const email = typeof payload.email == 'string' && payload.email.trim().length > 0 && payload.email.indexOf('@') > -1 ? payload.email.trim() : false
  const password = typeof payload.password == 'string' && payload.password.trim().length > 0 ? payload.password.trim() : false

  // Proceed if data is valid
  if (email && password) {
    // read in hashed password
    _data.read('users', email, (err, userData) => {
      if (err) return callback(401)
      if (userData.password !== helpers.hash(password)) return callback(401)
      // Create token
      const token = {
        id: helpers.createRandomString(config.uidLength),
        expiresAt: Date.now() + 1000 * 60 * 60
      }
      // Update user object
      const tokens = userData.tokens;
      const updatedUser = Object.assign({}, userData, { 'tokens': [...tokens, token] })
      _data.update('users', email, updatedUser, err => {
        if (err) return callback(500)
        callback(200, token.id)
      })
    })
  } else {
    callback(400, { 'Error': 'Missing required fields' })
  }
}

// Logout - POST
// mandatory fields: email
handlers.logout = ({ queryStringObject, headers, method }, callback) => {
  // Proceed only if post method
  if (method.trim() !== 'post') return callback(405)

  // validate mandatory data
  const email = typeof queryStringObject.email == 'string' && queryStringObject.email.trim().length > 0 && queryStringObject.email.indexOf('@') > -1 ? queryStringObject.email.trim() : false
  // If no email address has been provided, return with 405
  if (!email) return callback(400, { 'Error': 'Email address is mandatory.' })
  // check that user has a valid token in header
  if (!headers.id) return callback(401)
  // check if token is valid for user 
  _data.read('users', email, (err, userData) => {
    if (err) return callback(500, { 'Error': 'Internal error. Unable to validate token' })
    if (!helpers.authenticate(userData.tokens, headers.id)) return callback(401, { 'Error': 'Invalid or expired token. Please log in' })
    // All clear proceed
    // persist changes to disk
    const user = {
      tokens: []
    }
    const updatedUser = Object.assign({}, userData, user)
    // persist changes to disk
    _data.update('users', email, updatedUser, err => {
      if (err) return callback(500, { 'Error': 'Internal error, failed to update user details' })
      callback(200)
    })
  })
}

// Menu - GET
// Mandatory data: none
handlers.menu = ({ queryStringObject, headers }, callback) => {
  // validate mandatory data
  const email = typeof queryStringObject.email == 'string' && queryStringObject.email.trim().length > 0 && queryStringObject.email.indexOf('@') > -1 ? queryStringObject.email.trim() : false
  // If no email address has been provided, return with 405
  if (!email) return callback(405, { 'Error': 'Email address is mandatory.' })
  // check that user has a valid token in header
  if (!headers.id) return callback(401)
  // check if token is valid for user 
  _data.read('users', email, (err, userData) => {
    if (err) return callback(500, { 'Error': 'Internal error. Unable to validate token' })
    if (!helpers.authenticate(userData.tokens, headers.id)) return callback(401, { 'Error': 'Invalid or expired token. Please log in' })
    // All clear proceed
    // persist changes to disk
    callback(200, menu)
  })
}

// Shopping Cart 
// Shopping Cart - (GET, DELETE, PUT) Select appropriate handler for matching method
handlers.shoppingcart = (data, callback) => {
  if (['get', 'put', 'delete'].indexOf(data.method) > -1) {
    handlers._shoppingcart[data.method](data, callback)
  } else {
    callback(404)
  }
}

// cart object
handlers.cart = {}
// Declare container to hold user's private mehtods
handlers._shoppingcart = {}

// Shoppingcart - PUT - create or update shoppingcart
// mandatory data: email
handlers._shoppingcart.get = ({ queryStringObject, headers }, callback) => {
  // validate mandatory data
  const email = typeof queryStringObject.email == 'string' && queryStringObject.email.trim().length > 0 && queryStringObject.email.indexOf('@') > -1 ? queryStringObject.email.trim() : false
  // If missing required data, return with 405
  if (!email) return callback(405, { 'Error': 'Missing mandatory data: email' })
  // check that user has a valid token in header
  if (!headers.id) return callback(401)
  // check if token is valid for user 
  _data.read('users', email, (err, userData) => {
    if (err) return callback(500, { 'Error': 'Internal error. Unable to validate token' })
    if (!helpers.authenticate(userData.tokens, headers.id)) return callback(401, { 'Error': 'Invalid or expired token. Please log in' })
    // All clear proceed
    const myCart = handlers.cart[email] || []
    // Display cart Details
    const cartDetails = helpers.printCart(myCart)

    callback(200, cartDetails)
  })
}

// Shoppingcard - PUT
// add items to cart
handlers._shoppingcart.put = ({ headers, payload }, callback) => {
  // validate mandatory data
  const email = typeof payload.email == 'string' && payload.email.trim().length > 0 && payload.email.indexOf('@') > -1 ? payload.email.trim() : false

  const productId = typeof payload.productId == 'string' && Object.keys(menu).indexOf(payload.productId.trim()) > -1 ? payload.productId.trim() : false
  const quantity = typeof payload.quantity == 'number' && payload.quantity > 0 ? payload.quantity : false
  const size = typeof payload.size == 'string' && ['regular', 'medium', 'large', 'mega'].indexOf(payload.size.trim()) > -1 ? payload.size.trim() : false
  // If missing required data, return with 405
  if (!email || !productId || !quantity || !size) return callback(405, { 'Error': 'Missing mandatory data: email, productId, quantity & size.' })
  // check that user has a valid token in header
  if (!headers.id) return callback(401)
  // check if token is valid for user 
  _data.read('users', email, (err, userData) => {
    if (err) return callback(500, { 'Error': 'Internal error. Unable to validate token' })
    if (!helpers.authenticate(userData.tokens, headers.id)) return callback(401, { 'Error': 'Invalid or expired token. Please log in' })
    // All clear proceed
    // Add item to cart 
    const myCart = handlers.cart[email] || []
    let cartArray = []

    if (myCart.filter(item => item.productId === productId).length > 0) {
      cartArray = myCart.map(item => {
        if (item.productId === productId && item.size === size) return { productId: item.productId, size: item.size, quantity: item.quantity + quantity }
        return item
      })
    } else {
      cartArray = [...myCart, { productId, size, quantity }]
    }
    handlers.cart[email] = cartArray
    callback(200, cartArray)
  })
}
// Shopping cart - DELETE
// Mandatory data: email address, productId
handlers._shoppingcart.delete = ({ payload, headers }, callback) => {
  // validate mandatory data
  const email = typeof payload.email == 'string' && payload.email.trim().length > 0 && payload.email.indexOf('@') > -1 ? payload.email.trim() : false

  const productId = typeof payload.productId == 'string' && Object.keys(menu).indexOf(payload.productId.trim()) > -1 ? payload.productId.trim() : false

  // If missing required data, return with 405
  if (!email || !productId) return callback(405, { 'Error': 'Missing mandatory data: email and productId.' })
  // check that user has a valid token in header
  if (!headers.id) return callback(401)
  // check if token is valid for user 
  _data.read('users', email, (err, userData) => {
    if (err) return callback(500, { 'Error': 'Internal error. Unable to validate token' })
    if (!helpers.authenticate(userData.tokens, headers.id)) return callback(401, { 'Error': 'Invalid or expired token. Please log in' })
    // All clear proceed
    // check if cart contains the product
    const myCart = handlers.cart[email] || []

    // proceed to remove it from cart
    const newCart = myCart.filter(item => item.productId !== productId)

    // update customer cart object
    handlers.cart[email] = newCart
    callback(200, helpers.printCart(newCart))

  })
}


// Orders 
handlers.checkout = ({ method, queryStringObject, headers }, callback) => {
  if (method !== 'post') return callback(404)
  // validate required data
  // validate mandatory data
  const email = typeof queryStringObject.email == 'string' && queryStringObject.email.trim().length > 0 && queryStringObject.email.indexOf('@') > -1 ? queryStringObject.email.trim() : false
  if (!email) return callback(400, { 'Error': 'Missing required information: email' })

  if (!headers.id) return callback(401)
  // check if token is valid for user 
  _data.read('users', email, (err, userData) => {
    if (err) return callback(500, { 'Error': 'Internal error. Unable to validate token' })
    if (!helpers.authenticate(userData.tokens, headers.id)) return callback(401, { 'Error': 'Invalid or expired token. Please log in' })
    // All clear proceed
    // check if user has items in cart
    const checkForItems = typeof handlers.cart[email] == 'object' && handlers.cart[email].length > 0
    if (!checkForItems) return callback(400, { 'Error': 'No items in cart' })

    // Process cart
    const myCart = handlers.cart[email]
    // calculate amount to be charged
    const cartDetails = helpers.printCart(myCart)
    const amount = cartDetails.reduce((total, cartItem) => ({ total: total.total + cartItem.total }))

    //create order
    const order = {
      orderId: helpers.createRandomString(config.uidLength),
      email,
      date: Date.now(),
      cartDetails
    }
    // Create order
    _data.create('orders', order.orderId, order, err => {
      if (err) return callback(500, { 'Error': 'Internal server error, unable to create order' })

      // update user with order details
      _data.read('users', email, (err, userData) => {
        if (err) return callback(500)
        //update user data
        const userOrders = userData.orders || []
        const newUserOrders = [
          ...userOrders,
          order.orderId
        ]

        // Update user record with new order data
        userData.orders = newUserOrders
        _data.update('users', email, userData, err => {
          if (err) return callback(500, { 'Error': 'Internal error, unable to update user' })
          // process order payment
          // charge card
          helpers.chargeCard(email, amount.total * 100, order.orderId, (statusCharge, dataCharge) => {

            // check status of call 
            if (statusCharge !== 200) return callback(statusCharge, dataCharge)
            // Clear cart
            handlers.cart[email] = []
            // Declare object to hold receipt
            // create receipt object
            let receiptObject = {
              customer: email,
              orderId: order.orderId,
              date: Date.now(),
              amount: `${config.currency}. ${amount.total}`,
              items: cartDetails,
              status: dataCharge.outcome.seller_message
            }

            //send email to user, in case of error, log to console and continue else set a flag
            helpers.sendMail(email, cartDetails, (statusEmail, dataMail) => {
              if (statusEmail !== 200) console.log(`Failure to send an email to customer, ${email} with error: ${dataMail}`)
              receiptObject.emailSent = statusEmail === 200 ? true : false
              // persist receipt -- incase of errors, log to console and continue
              _data.create('receipts', order.orderId, receiptObject, err => {
                if (err) console.log(`Error creating receipt for order no. ${order.orderId}: ${err} `)
              })

              //construct response object to user
              const chargeResponse = Object.assign({}, { items: cartDetails }, { total: `${config.currency}. ${amount.total}` }, {
                'transaction': {
                  'charge amount': dataCharge.amount / 100,
                  'description': dataCharge.description,
                  'outcome': dataCharge.outcome.type,
                  'message': dataCharge.outcome.seller_message,
                  'status': dataCharge.status
                }
              })
              // return final response to user
              callback(200, chargeResponse)
            })
          })
        })
      })
    })

  })
}

// Export the module
module.exports = handlers