// const key = '...' // API Key
// const secret = '...' // API Private Key
const KrakenClient = require('kraken-api')
const kraken = new KrakenClient();

(async () => {
	// Display user's balance
  // console.log(await kraken.api('Balance'))

	// Get Ticker Info
  console.log((await kraken.api('Ticker', { pair: 'XETHZUSD' })).result.XETHZUSD.c[0])
})()
