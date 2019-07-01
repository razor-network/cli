const fs = require('fs').promises
let bip39 = require('bip39')
let hdkey = require('ethereumjs-wallet/hdkey')
let password = 'deadmonkey'
let Web3 = require('web3')

provider2 = 'wss://rinkeby.infura.io/ws'
let web3 = new Web3(Web3.givenProvider || provider2, null, {})

async function generateAddressesFromSeed (count) {
  let mnemonic = await fs.readFile('.secret')
  mnemonic = mnemonic.toString().trim()
  // console.log(typeof(mnemonic))
  // console.log(await bip39.mnemonicToSeed(mnemonic))
  let hdwallet = await hdkey.fromMasterSeed(await bip39.mnemonicToSeed(mnemonic))
  let wallet_hdpath = "m/44'/60'/0'/0/"

  let accounts = []
  for (let i = 0; i < 1; i++) {
    let wallet = await hdwallet.derivePath(wallet_hdpath + i)
    wallet = await wallet.getWallet()
    let address = '0x' + (await wallet.getAddress()).toString('hex')
    let privateKey = (await wallet.getPrivateKey()).toString('hex')
    accounts.push({address: address, privateKey: privateKey})

        // let wall = await web3.eth.accounts.create();
        // console.log(wallet.accounts)
        // console.log(wallet.privateKey)
        // console.log(await web3.eth.getAccounts())
    let walletEnc = await web3.eth.accounts.encrypt('0x' + privateKey, password)
        // console.log(walletEnc)
    let json = JSON.stringify(walletEnc)
    let walletDec = await web3.eth.accounts.decrypt(json, password)
    console.log(walletDec)
        // process.exit(0)
        // console.log(json)
        //
    await fs.writeFile('keys/' + address + '.json', json, 'utf8', function () {})
    console.log(address, 'created succesfully. fund this account with eth and sch before staking')
  }
  console.log(accounts)
  return accounts
}

generateAddressesFromSeed(12)
