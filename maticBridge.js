const api = require('./httpApi')
let Web3 = require('web3')
// let sleep = require('sleep')
let bridgeBuild = require('./build/contracts/Bridge.json')

let provider = 'https://rpc-mumbai.matic.today'
let web3 = new Web3(new Web3.providers.HttpProvider(provider))
let bridge = new web3.eth.Contract(bridgeBuild['abi'])
const fs = require('fs')

// var Tx = require('ethereumjs-tx').Transaction
// var ethjs = require('ethereumjs-util')

async function main() {
    copy()
    setInterval(() => copy(), 120000)
}
const privateKey = fs.readFileSync('.bridgeKey').toString().trim()
web3.eth.accounts.wallet.add(privateKey)
console.log('using address ', web3.eth.accounts.wallet[0].address)

async function setResult(i) {
    let result
    let nonce
    let dataTx
    result = await api.getResult(i)
    console.log('result', i, result)
    dataTx = bridge.methods.setResult(Number(i), Number(result)).encodeABI()
    nonce = await web3.eth.getTransactionCount(web3.eth.accounts.wallet[0].address, 'pending')
    console.log('nonce', nonce)

    var rawTx = {
        from: web3.eth.accounts.wallet[0].address,
        to: 0x2D50A444774EB4876e8e021E27125D0Aa91A7C7F,
        gas: 80000,
        data: dataTx
    }
    await web3.eth.sendTransaction(rawTx)
}

async function setJob(i) {
    let job
    let nonce
    let dataTx
    job = await api.getJob(i)
    console.log('job', i, job)
    console.log('setting', Number(i), job.url, job.selector, job.name, Number(job.result))
    dataTx = await bridge.methods.setJob(Number(i), job.url, job.selector, job.name, Number(job.result)).encodeABI()
    nonce = await web3.eth.getTransactionCount(web3.eth.accounts.wallet[0].address, 'pending')
    console.log('nonce', nonce)

    var rawTx = {
        from: web3.eth.accounts.wallet[0].address,
        to: 0x2D50A444774EB4876e8e021E27125D0Aa91A7C7F,
        gas: 2000000,
        data: dataTx
    }
    await web3.eth.sendTransaction(rawTx)
}

async function copy() {
    let numJobs = await api.getNumJobs()
    console.log('numJobs', numJobs)

    for (let i = 1; i <= numJobs; i++) {
        await setResult(i)
        await setJob(i)
    }
    console.log('synced', Date())
}

main()
