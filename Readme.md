## Razor network Client
End user client for Razor network.
## Installation
1.`npm i` \
2.`mv keys_sample.json keys.json`\
3. add api keys in keys.json

Please make sure that contracts repo is also cloned in parent directory and contracts are compiled with `truffle compile`.
e.g. contracts are in ~/contracts and this dir is ~/cli\

## Commands
Run the commands in following way:
    node index.js <commands>
You can run following commands in CLI:

`create <password>`  Creates a new wallet with given password. The wallets are stored in `keys/` directory.
Fund this account with ether and schells to start participating in the network.

    stake <amount> <address> <password>
    vote <apiId> <address> <password>
    unstake <address> <password>    
    withdraw <address> <password>
    transfer <toAddress> <fromAddress> <password>

`<address>` is the address of the wallet generated using create command.

`<apiId>`is the api to use to get ETHUSD price. 1 for Kraken, 2 for Gemini.

## Example

    node index.js create deadbeef
    node index.js stake 1000 0x5a0b54d5dc17e0aadc383d2db43b0a0d3e029c4c deadbeef
    node index.js vote 1 0x5a0b54d5dc17e0aadc383d2db43b0a0d3e029c4c deadbeef
