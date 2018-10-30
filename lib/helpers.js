/*
* Helpers for various tasks
*
*/

// Dependecies
const crypto = require('crypto')
const https = require('https')
const querystring = require('querystring')

const config = require('./config')
const menu = require('../.data/menu/menu.json')

// Container for all helper functions
const helpers = {}

helpers.hash = password => {
  if (typeof (password) == 'string' && password.length > 0) {
    const hash = crypto.createHmac('sha256', config.hashingSecret).update(password).digest('hex')
    return hash;
  }
}

helpers.parseToJSON = str => {
  try {
    return JSON.parse(str)
  } catch (e) {
    return {}
  }
}

helpers.filterUserFields = user => ({
  'id': user.id,
  'email': user.email,
  'name': user.name,
})

helpers.createRandomString = len => {
  const alphaNumeric = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let str = ''
  for (let i = 1; i <= len; i++) {
    let randomChar = alphaNumeric.charAt(Math.floor(Math.random() * alphaNumeric.length))
    str += randomChar
  }
  return str
}

helpers.authenticate = (tokens = [], token = '') => {
  if (token.length === 0 || tokens.length === 0) return false
  return tokens.filter(item => item.id === token && item.expiresAt > Date.now()).length > 0

}

helpers.chargeCard = (email, amount, orderId, callback) => {
  // Prepare form data
  // form data
  const postData = querystring.stringify({
    amount: amount,
    currency: 'kes',
    description: `Charge for ${email}`,
    source: 'tok_mastercard'
  })

  const options = {
    protocol: 'https:',
    host: 'api.stripe.com',
    method: 'POST',
    path: '/v1/charges',
    headers: {
      'Idempotency-Key': orderId,
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Bearer ${config.secret}`
    }
  }
  // instantiate request
  // request object
  const req = https.request(options, res => {
    let result = '';
    // bind to data event
    res.on('data', chunk => result += chunk);
    // bind to response end event
    res.on('end', () => callback(res.statusCode, JSON.parse(result)));
    // bind to response error
    res.on('error', err => {
      return callback(res.statusCode, JSON.parse(result))
    })
  });

  // bind to request error event
  req.on('error', err => callback(400, err))
  //send request with the postData form
  req.write(postData);
  req.end();
}


helpers.printCart = myCart => {
  return myCart.map(menuItem => {
    return {
      productId: menuItem.productId,
      name: menu[menuItem.productId].name,
      size: menuItem.size,
      price: menu[menuItem.productId].price[menuItem.size],
      quantity: menuItem.quantity,
      total: parseInt(menu[menuItem.productId].price[menuItem.size]) * menuItem.quantity
    }
  })
}

// Utility funcition to send mail via mailgun
// required data: email, cart items

helpers.sendMail = (toEmail, cart, callback) => {
  // Validate required information
  const email = typeof toEmail == 'string' && toEmail.trim().length > 0 && toEmail.indexOf('@') > -1 ? toEmail.trim() : false
  const cartItems = typeof cart == 'object' && cart.length !== 0 ? cart : false
  // Return if required info is not provided
  if (!email || !cartItems) return callback('Not enough information to send email')
  // 
  const items = cartItems.map(item => {
    return `
    ${item.name}\t\t ${item.quantity}\t\t ${item.total}\n
    `
  })
  // Get amount charged from cart items
  const amount = cart.reduce((total, cartItem) => ({ total: total.total + cartItem.total }))
  // construct email body
  const body = `
    Dear sir/madam,\n
    Thank you very much for your patronage. Find details below on your order:\n
    Name\t\t price\t\t quantity\t\t total\n
    ${items}
      -------------------------------------------------------------------------\n
      Total Bill: Kes. ${amount.total} \n\n

    Yours sincerely,\n
    Noritas Foodshack    
  `

  // form data
  var postData = querystring.stringify({
    from: 'Noritas FoodShack <info@noritafoods.com>',
    to: toEmail,
    subject: 'Payment Confirmation',
    text: body
  })

  // request option
  const options = {
    protocol: 'https:',
    host: 'api.mailgun.net',
    path: `/v3/${config.domain}/messages`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData),
      Authorization: 'Basic ' + Buffer.from('api:' + config.api_key).toString('base64')
    }
  };

  // instantiate request

  const req = https.request(options, res => {
    let result = '';
    // bind to resonse error event
    res.on('error', err  => callback(res.statusCode, err))
    // bind to response data event
    res.on('data', chunk => result += chunk);
    // bind to response end event
    res.on('end', () => callback(res.statusCode, JSON.parse(result)))
  })
  // Bind to the request error event so that it doesn't get thrown
  req.on('error', err => callback(400, err))
  // Add the payload
  req.write(postData)
  //End the request
  req.end()
}
module.exports = helpers