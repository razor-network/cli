node index.js s 1000000 0x21D7ACbcAEa5dD43e28c41b37A1296d6aAa4D912 1 &
node index.js s 1000000 0x50B2740e437410f30c2f679C06357eF1d76cedAE 1 &
node index.js s 1000000 0xe0431d3B7F453D008dFa92947F31Fba8969C0015 1234 &
node index.js s 1000000 0x484D0e98f78550DBBCf95D49573F77B4Ab50a38C 1 &
node index.js s 1000000 0xa186900e0e24C5a5943Ac10dF71B574debfFC74b 1 &

pm2 start index.js -- v

pm2 -f start index.js -- v 0xe0431d3B7F453D008dFa92947F31Fba8969C0015 1234

pm2 -f start index.js -- v 0x21D7ACbcAEa5dD43e28c41b37A1296d6aAa4D912 1
pm2 -f start index.js -- v 0x50B2740e437410f30c2f679C06357eF1d76cedAE 1
pm2 -f start index.js -- v 0x484D0e98f78550DBBCf95D49573F77B4Ab50a38C 1
pm2 -f start index.js -- v 0xa186900e0e24C5a5943Ac10dF71B574debfFC74b 1

node index.js j 'https://api.gemini.com/v1/pubticker/ethusd' 'last' ETH true 1 0x0519cA2C7B556fa3699107EC8348cA2573e90A75 1
node index.js j 'https://api.gemini.com/v1/pubticker/btcusd' 'last' BTC true 1 0x0519cA2C7B556fa3699107EC8348cA2573e90A75 1 
node index.js j 'https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=MSFT&apikey=demo' 'Global Quote["05. price"]' MSFT true 1 0x0519cA2C7B556fa3699107EC8348cA2573e90A75 1
node index.js j 'https://api.unibit.ai/v2/forex/realtime/?base=USD&foreign=EUR&amount=1&accessKey=demo' '["result_data"]["EUR"][0]["amount"]' EUR true 1 0x0519cA2C7B556fa3699107EC8348cA2573e90A75 1
