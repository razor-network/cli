// const express = require('express')
// var cors = require('cors')

// const bodyParser = require('body-parser')
const api = require('./httpApi')
let Web3 = require('web3')
let bridgeBuild = require('./build/contracts/Bridge.json')
// let provider = 'http://localhost:8545'
// let provider = 'http://35.188.201.171:8545'

let provider = 'https://testnet2.matic.network'
// let networkid = '420' // testnet
// let networkid = '4' // rinkeby
let matic3 = new Web3(provider, null, {})
// web3.setProvider(new web3.providers.HttpProvider('http://localhost:8545'))
matic3.eth.net.getId()
  .then(console.log)
let bridge = new matic3.eth.Contract(bridgeBuild['abi'])

var Tx = require('ethereumjs-tx').Transaction
var ethjs = require('ethereumjs-util')

// create express app
// const app = express()
//
// app.use(cors())
//
// // parse requests of content-type - application/x-www-form-urlencoded
// app.use(bodyParser.urlencoded({ extended: true }))
//
// // parse requests of content-type - application/json
// app.use(bodyParser.json())

// define a simple route
// app.get('/', (req, res) => {
//   res.json({'message': 'Welcome'})
// })

async function main () {
  try {
    // res = await api.login(process.argv[2], process.argv[3])
    // let res = await api.stake(amount, address).catch(console.log)
    //   if (res) {
    //     console.log('succesfully staked ', amount, ' schells')
    // }??
  } catch (e) {
    console.error(e)
  }

  setInterval(() => copy(), 10000)
}

async function copy () { // }(address, pk) {
  // console.log(pk)
  // const privateKey = Buffer.from(
  //   pk.slice(2,),
  //   'hex',
  // )

  var privateKey = new Buffer('e331b6d69882b4cb4ea581d88e0b604039a3de5967688d3dcffdd2270c0fd110', 'hex')

  let addy = ethjs.bufferToHex((ethjs.privateToAddress(privateKey)))
  let numJobs = await api.getNumJobs()
  console.log('numJobs', numJobs)
  let result
  let nonce
  for (let i = 1; i <= numJobs; i++) {
    // console.log(i, await bridge.methods.getResult(i).call())
    result = await api.getResult(i)
    console.log('result', i, result)
    nonce = await matic3.eth.getTransactionCount(addy)
    nonce = await matic3.utils.toHex(nonce)

    console.log('nonce', nonce)
    dataTx = bridge.methods.setResult(1, 420).encodeABI() // The encoded ABI of the method
    console.log('dataTx', dataTx)
    // console.log('address', address)
    var rawTx = {
      nonce: '0x0',
      gasPrice: null,
      gasLimit: matic3.utils.toHex(31000),
      from: addy,
      // gas: matic3.utils.toHex(100000),
      to: '0x5821d86DE0B4E30997319eE446C6eE7C98533C83',
      value: null,
      data: dataTx,
      chainId: matic3.utils.toHex(8995)
    }
    console.log(rawTx)
    var tx = new Tx(rawTx)
    tx.sign(privateKey)

    var serializedTx = tx.serialize()
    console.log('serialzed', '0x' + serializedTx.toString('hex'))
    matic3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'), async function (err, transactionHash) {
      if (!err) {
        console.log('hash', transactionHash)
        var receipt = await matic3.eth.getTransactionReceipt(transactionHash)
        console.log('rec', receipt)
      } else {
        console.error(err)
      }
    })
    // console.log('res', res)
    // await bridge.methods.setResult(i, result).send({from: process.argv[2], nonce: String(nonce)})
    await setTimeout(() => console.log('waiting'), 60000)
  }
  console.log('synced', Date())
}

main()
