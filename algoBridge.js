const api = require('./httpApi')
let Web3 = require('web3')
// let sleep = require('sleep')
let bridgeBuild = require('./build/contracts/Bridge.json')
const algosdk = require('algosdk');
const baseServer = "https://testnet-algorand.api.purestake.io/ps2";
const port = ""
var config = require('./config.json')

const token = {
  'X-API-key' : 'Phj6ripefW9ExTzrTYGy6hmuk4fZTZq11BE9VYqb',
}

let algodClient = new algosdk.Algodv2(token, baseServer, port);

let provider = config.provider
let web3 = new Web3(provider, null, {})
let bridge = new web3.eth.Contract(bridgeBuild['abi'])
const fs = require('fs')

async function main() {
    copy()
    setInterval(() => copy(), 120000)
}
const privateKey = fs.readFileSync('.bridgeKey').toString().trim()
web3.eth.accounts.wallet.add(privateKey)
console.log('using address ', web3.eth.accounts.wallet[0].address)

async function setJob(i) {
    let job
    let nonce
    let dataTx
    job = await api.getJob(i)
    console.log('job', i, job)
    console.log('setting', Number(i), job.url, job.selector, job.name, Number(job.result))
    let params = await algodClient.getTransactionParams().do();
    var mnemonic = "sustain deputy gospel hen arrange lazy erosion health sentence loan upset gate use shed feature similar seminar produce champion praise approve stage space absent broken";
    var recoveredAccount = algosdk.mnemonicToSecretKey(mnemonic)
    let userAddress = "POCE5GIBW74DEDEARWR6NHRTQ67F45CLG5SRGQQDKH37ALEASLDAZFQNME"
    let appIndex = 13312779
    let args = [i, job.url, job.selector, job.name, job.result];
    let appArgs = []
    args.forEach(function(arg){
        appArgs.push(new Uint8Array(Buffer.from(arg)));
    });
    console.log("args:", args);
    let callAppTxn = algosdk.makeApplicationNoOpTxn(userAddress, params, appIndex, appArgs);
    let rawSignedTxn = callAppTxn.signTxn(recoveredAccount.sk)

    let txId = callAppTxn.txID().toString();
    await algodClient.sendRawTransaction(rawSignedTxn).do()
    let transactionResponse = await algodClient.pendingTransactionInformation(txId).do();
    console.log("Called app-id:",JSON.stringify(transactionResponse));
}

async function copy() {
    let numJobs = await api.getNumJobs()
    console.log('numJobs', numJobs)

    // for (let i = 1; i <= numJobs; i++) {
    await setJob('1')

    console.log('synced', Date())
}

main()
