node index.js s 1000000 0x3Dd6cA6859776584d2Ec714746B5A3eFF429576b 1 &
node index.js s 1000000 0xEa416170dfAb0eBD7cebE2E28E042027AB96732d 1 &
node index.js s 1000000 0xeA279c981ce9146831BA09e6467683D81A5135a2 1 &
node index.js s 1000000 0x43F826321e326F571a31Ba9f2061b06A868bF350 1 &
node index.js s 1000000 0xF80a267A160A0604C1Fa47d7aF5CF978BDa54B41 1 &

0x3Dd6cA6859776584d2Ec714746B5A3eFF429576b.json  0xEa416170dfAb0eBD7cebE2E28E042027AB96732d.json  0xeA279c981ce9146831BA09e6467683D81A5135a2.json
0x43F826321e326F571a31Ba9f2061b06A868bF350.json  0xF80a267A160A0604C1Fa47d7aF5CF978BDa54B41.json
pm2 start index.js -- v

pm2 -f start index.js -- v 0x3Dd6cA6859776584d2Ec714746B5A3eFF429576b 1

pm2 -f start index.js -- v 0xEa416170dfAb0eBD7cebE2E28E042027AB96732d 1
pm2 -f start index.js -- v 0xeA279c981ce9146831BA09e6467683D81A5135a2 1
pm2 -f start index.js -- v 0x43F826321e326F571a31Ba9f2061b06A868bF350 1
pm2 -f start index.js -- v 0xF80a267A160A0604C1Fa47d7aF5CF978BDa54B41 1

node index.js j 'https://api.gemini.com/v1/pubticker/ethusd' 'last' ETH true 1 0x0519cA2C7B556fa3699107EC8348cA2573e90A75 1
node index.js j 'https://api.gemini.com/v1/pubticker/btcusd' 'last' BTC true 1 0x0519cA2C7B556fa3699107EC8348cA2573e90A75 1
node index.js j 'https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=MSFT&apikey=demo' 'Global Quote["05. price"]' MSFT true 1 0x0519cA2C7B556fa3699107EC8348cA2573e90A75 1
node index.js j 'https://api.unibit.ai/v2/forex/realtime/?base=USD&foreign=EUR&amount=1&accessKey=demo' '["result_data"]["EUR"][0]["amount"]' EUR true 1 0x0519cA2C7B556fa3699107EC8348cA2573e90A75 1
