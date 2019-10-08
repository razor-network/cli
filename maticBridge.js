const api = require('./httpApi')
let Web3 = require('web3')
let sleep = require('sleep')
let bridgeBuild = require('./build/contracts/Bridge.json')

let provider = 'https://testnet2.matic.network'
let matic3 = new Web3(provider, null, {})
let bridge = new matic3.eth.Contract(bridgeBuild['abi'])

var Tx = require('ethereumjs-tx').Transaction
var ethjs = require('ethereumjs-util')

async function main () {
  copy()
  setInterval(() => copy(), 120000)
}

var privateKey = '0xe331b6d69882b4cb4ea581d88e0b604039a3de5967688d3dcffdd2270c0fd110'
matic3.eth.accounts.wallet.add(privateKey)
console.log('using address ', matic3.eth.accounts.wallet[0].address)

async function copy () {
  let numJobs = await api.getNumJobs()
  console.log('numJobs', numJobs)
  let result
  let nonce
  for (let i = 1; i <= numJobs; i++) {
    // console.log(i, await bridge.methods.getResult(i).call())
    result = await api.getResult(i)
    console.log('result', i, result)
    // nonce = await matic3.eth.getTransactionCount(addy)
    // nonce = await matic3.utils.toHex(nonce)

    dataTx = bridge.methods.setResult(Number(i), Number(result)).encodeABI() // The encoded ABI of the method
    // console.log('dataTx', dataTx)
    // console.log('address', address)
    nonce = await matic3.eth.getTransactionCount(matic3.eth.accounts.wallet[0].address, 'pending')
    console.log('nonce', nonce)

    var rawTx = {
      from: matic3.eth.accounts.wallet[0].address,
      to: '0xA1Bb7956066c589c424210B5Bf94fa647829B099',
      gas: 80000,
      // nonce: nonce,
      // value: null,
      data: dataTx
    }
    // console.log(rawTx)

    await matic3.eth.sendTransaction(rawTx)
  // await bridge.methods.setResult(i, result).send({from: process.argv[2], nonce: String(nonce)})
  // await sleep.sleep(120)
  }
  console.log('synced', Date())
}

main()
