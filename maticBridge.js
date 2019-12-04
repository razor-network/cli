const api = require('./httpApi')
let Web3 = require('web3')
// let sleep = require('sleep')
let bridgeBuild = require('./build/contracts/Bridge.json')

let provider = 'https://testnet2.matic.network'
let web3 = new Web3(provider, null, {})
let bridge = new web3.eth.Contract(bridgeBuild['abi'])

// var Tx = require('ethereumjs-tx').Transaction
// var ethjs = require('ethereumjs-util')

async function main() {
    copy()
    setInterval(() => copy(), 120000)
}
const fs = require('fs')
const privateKey = fs.readFileSync('.bridgeKey').toString().trim()
web3.eth.accounts.wallet.add(privateKey)
console.log('using address ', web3.eth.accounts.wallet[0].address)

async function copy() {
    let numJobs = await api.getNumJobs()
    console.log('numJobs', numJobs)
    let result
    let nonce
    let dataTx
    for (let i = 1; i <= numJobs; i++) {
        result = await api.getResult(i)
        console.log('result', i, result)
        dataTx = bridge.methods.setResult(Number(i), Number(result)).encodeABI()
        nonce = await web3.eth.getTransactionCount(web3.eth.accounts.wallet[0].address, 'pending')
        console.log('nonce', nonce)

        var rawTx = {
            from: web3.eth.accounts.wallet[0].address,
            to: '0xe44c3c78782aADC88E7BDc920e0570fF93b3585a',
            gas: 80000,
            data: dataTx
        }
        await web3.eth.sendTransaction(rawTx)
    }
    console.log('synced', Date())
}

main()
