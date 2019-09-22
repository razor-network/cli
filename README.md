## Razor network Client
End user client for Razor network.
## Installation
1.`npm i` \
2.`mv keys_sample.json keys.json`\
3. add api keys in keys.json\
4. create directory 'keys'


## Commands
Run the commands in following way:
    node index.js <commands>
You can run following commands in CLI:

`-help` See a list of available commands
`create <password>`  Creates a new wallet with given password. The wallets are stored in `keys/` directory.
WARNING: this is not a secure method of key generation, DO NOT use it for assets on mainnet.
Fund this account with ether and schells to start participating in the network.

    stake <amount> <address> <password>
    vote <address> <password>
    unstake <address> <password>    
    withdraw <address> <password>
    transfer <toAddress> <fromAddress> <password>

`<address>` is the address of the wallet generated using create command.

## Example

    node index.js create deadbeef
    node index.js stake 1000 0x5a0b54d5dc17e0aadc383d2db43b0a0d3e029c4c deadbeef
    node index.js vote 0x5a0b54d5dc17e0aadc383d2db43b0a0d3e029c4c deadbeef
