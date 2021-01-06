const api = require('./httpApi')
let Web3 = require('web3')
// let sleep = require('sleep')
const mtr = require("meterify").meterify;
let bridgeBuild = require('./build/contracts/Bridge.json')

let provider = 'https://rpctest.meter.io'

const meterify = new Web3(new Web3.providers.HttpProvider(provider))

let bridge = new meterify.eth.Contract(bridgeBuild['abi'])
const fs = require('fs')

// var Tx = require('ethereumjs-tx').Transaction
// var ethjs = require('ethereumjs-util')

async function main() {
    copy()
    setInterval(() => copy(), 300000)
}
const privateKey = fs.readFileSync('.bridgeKey').toString().trim()
meterify.eth.accounts.wallet.add(privateKey)
console.log('using address ', meterify.eth.accounts.wallet[0].address)

async function setResult(i) {
    let result
    let dataTx
    result = await api.getResult(i)
    console.log('result', i, result)
    dataTx = bridge.methods.setResult(Number(i), Number(result)).encodeABI()

    var rawTx = {
        from: meterify.eth.accounts.wallet[0].address,
        to: "0x0873B12aDbF2eAeDFD684E38ec22DF17C58017AD",
        gas: 80000,
        data: dataTx
    }
    await meterify.eth.sendTransaction(rawTx)
}

async function setJob(i) {
    let job
    let dataTx
    job = await api.getJob(i)
    console.log('job', i, job)
    console.log('setting', Number(i), job.url, job.selector, job.name, Number(job.result))
    dataTx = await bridge.methods.setJob(Number(i), job.url, job.selector, job.name, Number(job.result)).encodeABI()

    var rawTx = {
        from: meterify.eth.accounts.wallet[0].address,
        to: "0x0873B12aDbF2eAeDFD684E38ec22DF17C58017AD",
        gas: 2000000,
        data: dataTx
    }
    await meterify.eth.sendTransaction(rawTx)
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
