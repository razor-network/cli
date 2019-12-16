node index.js s 1000000 0x1D68ad204637173b2d8656B7972c57dcE41Bc80e 1 &
node index.js s 1000000 0x9FF5085aa345C019cDF2A427B02Bd6746DeF549B 1 &
node index.js s 1000000 0xc4695904751Ad8414c75798d6Ff2579f55e61522 1 &
node index.js s 1000000 0x40d57C3F5c3BAbac3033E2D50AB7C6886A595F46 1 &
node index.js s 1000000 0xa2B827aCF6073f5D9e2350cbf0646Ba2535a5B0C 1 &

pm2 start index.js -- v

pm2 -f start index.js -- v 0x1D68ad204637173b2d8656B7972c57dcE41Bc80e 1

pm2 -f start index.js -- v 0x9FF5085aa345C019cDF2A427B02Bd6746DeF549B 1
pm2 -f start index.js -- v 0xc4695904751Ad8414c75798d6Ff2579f55e61522 1
pm2 -f start index.js -- v 0x40d57C3F5c3BAbac3033E2D50AB7C6886A595F46 1
pm2 -f start index.js -- v 0xa2B827aCF6073f5D9e2350cbf0646Ba2535a5B0C 1

node index.js j 'https://api.gemini.com/v1/pubticker/ethusd' 'last' ETH true 1 0x1D68ad204637173b2d8656B7972c57dcE41Bc80e 1
node index.js j 'https://api.gemini.com/v1/pubticker/btcusd' 'last' BTC true 1 0x1D68ad204637173b2d8656B7972c57dcE41Bc80e 1
node index.js j 'https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=MSFT&apikey=demo' 'Global Quote["05. price"]' MSFT true 1 0x1D68ad204637173b2d8656B7972c57dcE41Bc80e 1
node index.js j 'https://api.unibit.ai/v2/forex/realtime/?base=USD&foreign=EUR&amount=1&accessKey=demo' '["result_data"]["EUR"][0]["amount"]' EUR true 1 0x1D68ad204637173b2d8656B7972c57dcE41Bc80e 1
