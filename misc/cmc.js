/* Example in Node.js ES6 using request-promise */

const rp = require('request-promise')
const requestOptions = {
  method: 'GET',
  uri: 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest',
  qs: {
    'symbol': 'ETH'
  },
  headers: {
    'X-CMC_PRO_API_KEY': 'bf4e201d-681c-4f84-b63c-55eac2d75299'
  },
  json: true,
  gzip: true
}

rp(requestOptions).then(response => {
  console.log('API call response:', response.data.ETH.quote.USD.price)
}).catch((err) => {
  console.log('API call error:', err.message)
})
