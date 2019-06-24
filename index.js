/* global: console */
// arguments 2accountNumber, 3amountToStake, 4apiID
// apiid 0 = CMC
// apiid 1 = kraken
let Web3 = require('web3')
// let {Accounts} = require('web3-eth-accounts')
let rp = require('request-promise')
let program = require('commander')
let KrakenClient = require('kraken-api')
const kraken = new KrakenClient()
let provider = 'ws://localhost:8545'
provider2 = 'wss://rinkeby.infura.io/ws'
let networkid = '4'
let web3 = new Web3(Web3.givenProvider || provider2, null, {})
const fs = require('fs').promises
const { randomHex } = require('web3-utils')

// let account = new Accounts(Web3.givenProvider || provider, null, {})

// wss://rinkeby.infura.io/ws

const sleep = require('util').promisify(setTimeout)

let schellingBuild = require('../contracts/build/contracts/Schelling2.json')
let keys = require('./keys.json')
let schellingAbi = schellingBuild['abi']
let schelling = new web3.eth.Contract(schellingAbi, schellingBuild['networks'][networkid].address,
  {transactionConfirmationBlocks: 1,
    defaultGas: 6000000})

let simpleTokenBuild = require('../contracts/build/contracts/SimpleToken.json')
let simpleTokenAbi = simpleTokenBuild['abi']
let simpleToken = new web3.eth.Contract(simpleTokenAbi, simpleTokenBuild['networks'][networkid].address,
  {transactionConfirmationBlocks: 1,
    defaultGas: 6000000})

// let account0
// let account00
// let account1
let price
let lastCommit = -1
let lastReveal = -1
let lastProposal = -1
// let staked = false
// let staking = false

let requestOptions = {
  method: 'GET',
  uri: 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest',
  qs: {
    'symbol': 'ETH'
  },
  headers: {
    'X-CMC_PRO_API_KEY': keys['cmc']
  },
  json: true,
  gzip: true
}

let geminiRequestOptions = {
  method: 'GET',
  uri: 'https://api.gemini.com/v1/pubticker/ethusd',
  json: true,
  gzip: true
}

console.log('web3 version', web3.version)

// Require logic.js file and extract controller functions using JS destructuring assignment
// const { addContact, getContact } = require('./logic')

program
  .version('0.0.1')
  .description('Schelling network')

program
  .command('stake <amount> <address> <password>')
  .alias('s')
  .description('Stake some schells')
  .action(async function (amount, address, password) {
    await web3.eth.accounts.wallet.create(0, randomHex(32))
    let rawdata = await fs.readFile('keys/' + address + '.json')
    // console.log(rawdata)

    let keystoreArray = JSON.parse(rawdata)
    // console.log(keystoreArray)
    let wall = await web3.eth.accounts.wallet.decrypt([keystoreArray], password)
    console.log(wall.accounts[0].privateKey)

    const pk = wall.accounts[0].privateKey
    const account = await web3.eth.accounts.privateKeyToAccount(pk)
    await web3.eth.accounts.wallet.add(account)
    const from = await web3.eth.accounts.wallet.accounts[0].address

    // let account = (await web3.eth.personal.getAccounts())[Number(accountId)]
    let res = await stake(amount, from).catch(console.log)
    if (res) {
      console.log('succesfully staked ', amount, ' schells')
      process.exit(0)
    }
  })
program
    .command('unstake <accountId>')
    .alias('u')
    .description('Unstake all schells')
    .action(async function (accountId) {
      let account = (await web3.eth.personal.getAccounts())[Number(accountId)]
      let res = await unstake(account).catch(console.log)
      if (res) console.log('succesfully unstaked all schells')
      process.exit(0)
    })

program
        .command('withdraw <accountId>')
        .alias('w')
        .description('Withdraw all schells. Make sure schells are unstaked and unlocked')
        .action(async function (accountId) {
          let account = (await web3.eth.personal.getAccounts())[Number(accountId)]
          let res = await withdraw(account).catch(console.log)
          if (res) console.log('succesfully withdrew all schells')
          process.exit(0)
        })

program
  .command('vote <accountId> <api>')
  .alias('v')
  .description('Start monitoring contract, commit,vote and propose automatically')
  .action(async function (accountId, api) {
    let account = (await web3.eth.personal.getAccounts())[Number(accountId)]
    api = Number(api)
    await main(account, api).catch(console.log)
  })

program
    .command('transfer <to> <amount> <from>')
    .alias('t')
    .description('transfer schells')
    .action(async function (to, amount, from) {
      let accountFrom = (await web3.eth.personal.getAccounts())[Number(from)]
      let accountTo = (await web3.eth.personal.getAccounts())[Number(to)]

      let res = await transfer(accountTo, amount, accountFrom).catch(console.log)
      if (res) console.log('succesfully transferred')
      process.exit(0)
    })

program
        .command('create <password>')
        .alias('c')
        .description('create wallet with given password')
        .action(async function (password) {
          let wallet = await web3.eth.accounts.create()
        // console.log(wallet.accounts)
        // console.log(wallet.privateKey)
        // console.log(await web3.eth.getAccounts())
          let walletEnc = await web3.eth.accounts.encrypt(wallet.privateKey, password)
        // console.log(walletEnc)
        //
          let json = JSON.stringify(walletEnc)
        // console.log(json)
        //
          await fs.writeFile(wallet.address + '.json', json, 'utf8', function () {})
          console.log(wallet.address, 'created succesfully. fund this account with eth and sch before staking')
          process.exit(0)
        })

program.parse(process.argv)
async function getBiggestStakerId () {
  let numStakers = Number(await schelling.methods.numNodes().call())
  console.log('numStakers', numStakers)
  let biggestStake = 0
  let biggestStakerId = 0
  for (let i = 1; i <= numStakers; i++) {
    let stake = Number((await schelling.methods.nodes(i).call()).stake)
    if (stake > biggestStake) {
      biggestStake = stake
      biggestStakerId = i
    }
  }
  return biggestStakerId
}

async function transfer (to, amount, from) {
  let res = await simpleToken.methods.transfer(to, amount).send({'from': from})
  console.log(res)
  return (res.events.Transfer.event === 'Transfer')
}

async function approve (to, amount, from) {
  const nonce = await web3.eth.getTransactionCount(from, 'pending')
  console.log(nonce)
  let gas = await simpleToken.methods
    .approve(to, amount)
    .estimateGas({ from, gas: '6000000'})
  gas = Math.round(gas * 1.5)

  console.log(gas)

  return simpleToken.methods.approve(to, amount).send({
    gas,
    from,
    nonce})
}

async function stake (amount, account) {
  let epoch = Number(await schelling.methods.getEpoch.call())
  let state = Number(await schelling.methods.getState.call())

  while (true) {
    epoch = Number(await schelling.methods.getEpoch.call())
    state = Number(await schelling.methods.getState.call())
    console.log('epoch', epoch)
    console.log('state', state)
    if (state !== 0) {
      console.log('Can only stake during state 0 (commit). Retrying in 5 seconds...')
      await sleep(5000)
    } else break
  }

  console.log('account', account)
  let balance = Number(await simpleToken.methods.balanceOf(account).call())
  console.log('balance', balance)
  if (balance < amount) throw new Error('Not enough schells to stake')
  let tx = await approve(schelling.address, amount, account)
  console.log(tx.events)
  if (tx.events.Approval.event !== 'Approval') throw new Error('Approval failed')

  let nonce = await web3.eth.getTransactionCount(account, 'pending')
  console.log(nonce)
  let gas = await schelling.methods
    .stake(epoch, amount)
    .estimateGas({ account, gas: '6000000'})
  gas = Math.round(gas * 1.5)

  console.log(gas)

  let tx2 = await schelling.methods.stake(epoch, amount).send({
    gas,
    account,
    nonce})
  console.log(tx.events)
  // console.log(tx2.events.Staked.event === 'Staked')
  return (tx2.events.Staked.event === 'Staked')
}

async function unstake (account) {
  let epoch = Number(await schelling.methods.getEpoch.call())
  console.log('epoch', epoch)
  console.log('account', account)
  let balance = Number(await simpleToken.methods.balanceOf(account).call())
  console.log('balance', balance)
  if (balance === 0) throw new Error('balance is 0')
  let tx = await schelling.methods.unstake(epoch).send({'from': account})
  console.log(tx.events)
  // console.log(tx2.events.Staked.event === 'Staked')
  return (tx.events.Unstaked.event === 'Unstaked')
}

async function withdraw (account) {
  let epoch = Number(await schelling.methods.getEpoch.call())
  console.log('epoch', epoch)
  console.log('account', account)
  let balance = Number(await simpleToken.methods.balanceOf(account).call())
  console.log('balance', balance)
  if (balance === 0) throw new Error('balance is 0')
  let tx = await schelling.methods.withdraw(epoch).send({'from': account})
  console.log(tx.events)
  // console.log(tx2.events.Staked.event === 'Staked')
  return (tx.events.Unstaked.event === 'Unstaked')
}

async function commit (price, secret, account) {
  if (Number(await schelling.methods.getState().call()) != 0) {
    throw ('Not commit state')
  }
  let epoch = Number(await schelling.methods.getEpoch.call())
  let commitment = web3.utils.soliditySha3(epoch, price, secret)

  let tx = await schelling.methods.commit(epoch, commitment).send({'from': account})
  return tx
}

async function reveal (price, secret, commitAccount, account) {
    // let tx = await schelling.reveal(1, 160, '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9ddd', accounts[1], { 'from': accounts[1]})
  if (Number(await schelling.methods.getState().call()) != 1) {
    throw ('Not reveal state')
  }
  let node = Number(await schelling.methods.nodeIds(account).call())
  console.log('node', node)
  let epoch = Number(await schelling.methods.getEpoch().call())
  console.log('epoch', epoch)
  let commitment = await schelling.methods.commitments(epoch, node).call()
  // commitments[epoch][thisNodeId]
  console.log('commitment', commitment)
  console.log('price', price)
  let recalc = web3.utils.soliditySha3(epoch, price, secret)
  console.log('recalc', recalc)
  console.log('revealing Number(await schelling.methods.getEpoch().call()), price, secret, commitAccount', Number(await schelling.methods.getEpoch().call()), price, secret, commitAccount)
  // let commitment = web3.utils.soliditySha3((Number(await schelling.getEpoch())), amount, '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9111')
  let tx = await schelling.methods.reveal(epoch, price, secret, commitAccount).send({'from': account})
  return tx
}
async function getElectedProposer () {
  let electedProposer
  let iteration
  let biggestStakerId = await getBiggestStakerId()
  let numNodes = Number(await schelling.methods.numNodes().call())
  let isElectedProposer
  console.log('biggestStakerId', biggestStakerId)
  console.log('numNodes', numNodes)
  for (let j = 0; ; j++) { // iternation
   // ////console.log('j', j)

    for (let k = 1; k <= numNodes; k++) { // node
      isElectedProposer = await schelling.methods.isElectedProposer(j, biggestStakerId, k).call()
      console.log('isElectedProposer', isElectedProposer)
      if (isElectedProposer) {
        let node = await schelling.methods.nodes(k).call()
        iteration = j
        electedProposer = k
        console.log('j,electedProposer,nodeId, stake', j, electedProposer, Number(node.id), Number(node.stake))
        break
      }
    }
    if (isElectedProposer) break
  }
  return [electedProposer, iteration, biggestStakerId]
}

async function getSortedVotes () {
  let epoch = Number(await schelling.methods.getEpoch().call())

  let numNodes = Number(await schelling.methods.numNodes().call())
  let values = []
  let voteWeights = []

// get all values that stakers voted.
  for (let i = 1; i <= numNodes; i++) {
    // console.log(await schelling.methods.votes(i).call())
    let vote = Number((await schelling.methods.votes(epoch, i).call()).value)
    if (vote === 0) continue // didnt vote
    if (values.indexOf(vote) === -1) values.push(vote)
  }
  values.sort(function (a, b) { return a - b })

  // get weights of those values
  for (let val of values) {
    let weight = Number(await schelling.methods.voteWeights(epoch, val).call())
    voteWeights.push([val, weight])
  }
  return [values, voteWeights]
}

async function makeBlock () {
  let res = await getSortedVotes()
  let sortedVotes = res[1]
  console.log('sortedVotes', sortedVotes)
  let epoch = Number(await schelling.methods.getEpoch().call())

  let totalStakeRevealed = Number(await schelling.methods.totalStakeRevealed(epoch).call())
  console.log('totalStakeRevealed', totalStakeRevealed)
  let medianWeight = Math.floor(totalStakeRevealed / 2)
  console.log('medianWeight', medianWeight)
  // let twoFiveWeight = Math.floor(totalStakeRevealed / 4)
  // console.log('twoFiveWeight', twoFiveWeight)
  // let sevenFiveWeight = Math.floor(totalStakeRevealed * 3 / 4)
  // console.log('sevenFiveWeight', sevenFiveWeight)

  let i = 0
  let twoFive = 0
  let sevenFive = 0
  let median = 0
  let weight = 0
  let stakeGettingReward = 0
  let stakeGettingPenalty = 0
  for (i = 0; i < sortedVotes.length; i++) {
    weight += sortedVotes[i][1]
    console.log('weight', weight)
    // if (weight > twoFiveWeight && twoFive === 0) twoFive = sortedVotes[i][0]
    if (weight > medianWeight && median === 0) median = sortedVotes[i][0]
    // if (weight >= sevenFiveWeight && sevenFive === 0) sevenFive = sortedVotes[i][0]
    // if (twoFive === 0 || sevenFive < sortedVotes[i][0]) {
    //   stakeGettingPenalty += sortedVotes[i][1]
    // } else {
    //   stakeGettingReward += sortedVotes[i][1]
    // }
  }
  return (median)
}

async function propose (account) {
  if (Number(await schelling.methods.getState().call()) != 2) {
    throw ('Not propose state')
  }
  let numNodes = Number(await schelling.methods.numNodes().call())
  console.log('numNodes', numNodes)
  let epoch = Number(await schelling.methods.getEpoch().call())
  console.log('epoch', epoch)

  let res = await getElectedProposer()
  let electedProposer = res[0]
  let iteration = res[1]
  let biggestStakerId = res[2]
  console.log('biggestStakerId', biggestStakerId)
  console.log('electedProposer, iteration', electedProposer, iteration)
  let block = await makeBlock()
  console.log('block', block)
  let median = block
  // let twoFive = block[1]
  // let sevenFive = block[2]
  // let stakeGettingPenalty = block[3]
  // let stakeGettingReward = block[4]

    // ////console.log('i', i)
  console.log('epoch, median, iteration, biggestStakerId', epoch, median, iteration, biggestStakerId)
    // let tx = await schelling.reveal(1, 160, '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9ddd', accounts[1], { 'from': accounts[1]})
  // let commitment = web3.utils.soliditySha3((Number(await schelling.getEpoch())), amount, '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9111')
  let tx = await schelling.methods.propose(epoch, median, iteration, biggestStakerId).send({'from': account})
  return tx
}

// automatically calculate alternative block and submit
async function dispute (account) {
// function giveSorted (uint256 epoch, uint256[] memory sorted) public checkEpoch(epoch) checkState(c.DISPUTE) {
  let epoch = Number(await schelling.methods.getEpoch().call())
  let res = await getSortedVotes()
  let sortedVotes = res[0]
  let iter = Math.ceil(sortedVotes.length / 1000)
  for (let i = 0; i < iter; i++) {
    console.log(epoch, sortedVotes.slice(i * 1000, (i * 1000) + 1000))
    await schelling.methods.giveSorted(epoch, sortedVotes.slice(i * 1000, (i * 1000) + 1000)).send({from: account})
  }
  return schelling.methods.proposeAlt(epoch).send({from: account})
}

async function getPrice (api) {
  if (api === 0) {
    return rp(requestOptions).then(response => {
      let prr = response.data.ETH.quote.USD.price
      if (!prr) return getPrice(1)
      prr = Math.floor(Number(prr) * 100)
      console.log('CM price', prr)
      return prr
    // console.log('API call response:', response.data.ETH.quote.USD.price)
    }).catch((err) => {
      console.log('API call error:', err.message)
    })
  } else if (api === 1) {
    return rp(geminiRequestOptions).then(response => {
      let prr = response.last
      if (!prr) return getPrice(2)
      prr = Math.floor(Number(prr) * 100)
      console.log('Gemini price', prr)
      return prr
    // console.log('API call response:', response.data.ETH.quote.USD.price)
    }).catch((err) => {
      console.log('API call error:', err.message)
    })
  } else {
    let prr = await kraken.api('Ticker', { pair: 'XETHZUSD' })
    prr = prr.result.XETHZUSD.c
    if (!prr) return getPrice(0)
    prr = Math.floor(Number(prr[0]) * 100)
    console.log('Kraken Price', prr)
    return prr
  }
}

// async function main2 () {
  // account0 = (await web3.eth.personal.getAccounts())[0]
  // account1 = (await web3.eth.personal.getAccounts())[1]
  // let price = await getPrice()
  // console.log(price)
  // console.log('account0', account0)
  // console.log('schelling.address', schelling.address)
  // let tx = await simpleToken.methods.approve(schelling.address, 420000).send({'from': account0})
  // console.log(tx)
  // await schelling.methods.setEpoch(1).send({'from': account0})
  // await schelling.methods.setState(0).send({'from': account0})
  //
  // tx = await stake(420000, account0)
  // console.log(tx)
  // tx = await commit(160, '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9111', account0)
  // console.log(tx)
  // await schelling.methods.setState(1).send({'from': account0})
  // // async function reveal (price, secret, commitAccount, account) {
  //
  // tx = await reveal(160, '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9111', account0, account0)
  // console.log(tx)
  // await schelling.methods.setState(2).send({'from': account0})
  // // tx = await propose(account0)
  // console.log(await getBiggestStakerId())
  // console.log(await getElectedProposer())
  // tx = await schelling.methods.propose(1, 1, 1, 1, 0, 1, 0, 1).send({'from': account0})
  //
  // console.log(tx)
  // await schelling.methods.setState(3).send({'from': account0})
  // tx = await dispute(account1)
  // console.log(tx)
// }

async function main (account, api) {
  schelling.events.Proposed().on('data', async function (data) {
    console.log('gotcha')
    console.log(data)
    let median = Number(data.returnValues.median)
    // let twoFive = Number(data.returnValues.twoFive)
    // let sevenFive = Number(data.returnValues.sevenFive)
    // let stakeGettingPenalty = Number(data.returnValues.stakeGettingPenalty)
    // let stakeGettingReward = Number(data.returnValues.stakeGettingReward)

    let block = await makeBlock()
    console.log('block', block)
    // return ([median, twoFive, sevenFive, stakeGettingPenalty, stakeGettingReward])
    if (median !== block
      // ||
        // twoFive !== block[1] ||
        // sevenFive !== block[2] ||
        // stakeGettingPenalty != block[3] ||
        // stakeGettingReward != block[4]
      ) {
      console.log('WARNING: BLOCK NOT MATCHING WITH LOCAL CALCULATIONS. local median:' + block + 'block median:', median)
    }
  })
  web3.eth.subscribe('newBlockHeaders', async function (error, result) {
    if (!error) {
      console.log(result)
      return
    }
    throw (error)
  })
.on('data', async function (blockHeader) {
  // commit

  let state = Number(await schelling.methods.getState().call())
  let epoch = Number(await schelling.methods.getEpoch().call())
  let yourId = Number(await schelling.methods.nodeIds(account).call())

  let balance = Number((await schelling.methods.nodes(yourId).call()).stake)
  console.log('You have staked ', balance, ' schells')
  console.log('block #', blockHeader.number, 'epoch', epoch, 'state', state, 'account', account, 'nodeId', yourId, 'stakedBalance', balance)
  if (balance < Number((await schelling.methods.c().call()).MIN_STAKE)) throw new Error('Stake is below minimum required. Cannot vote.')
  // console.log('staked', staked)
  // console.log('account0', account0)
  // console.log('account1', account1)

  // if (!staking) {
  //   if (state !== 1) {
  //     staking = true
  //     account00 = (await web3.eth.personal.getAccounts())[0]
  //     account0 = (await web3.eth.personal.getAccounts())[Number(process.argv[2])]
  //     console.log(account0, 'account0')
  //   // account1 = (await web3.eth.personal.getAccounts())[1]
  //     let amount = Number(process.argv[3])
  //     console.log('amount', amount)
  //     let tx = await simpleToken.methods.transfer(account0, amount).send({'from': account00})
  //     console.log(tx.events)
  //
  //     tx = await stake(amount, account0)
  //     console.log(tx.events)
  //     staked = true
  //   }
  // } else if (staked) {
    // let yourId = Number(await schelling.methods.nodeIds(account0).call())

    // let balance = Number((await schelling.methods.nodes(yourId).call()).stake)
    // console.log('your balance', balance)
  if (state === 0) {
    if (lastCommit < epoch) {
      lastCommit = epoch
      price = await getPrice(api)
      console.log('lets commit', price)
      console.log('last commit', epoch)

      let secret = web3.utils.keccak256(await web3.eth.sign(web3.utils.keccak256(account, epoch), account))

      let tx = await commit(price, secret, account)
      console.log(tx.events)
    }
  } else if (state === 1) {
    if (lastReveal < epoch && lastCommit === epoch) {
      console.log('last reveal', epoch)
      console.log('lets reveal')
      lastReveal = epoch
      let yourId = Number(await schelling.methods.nodeIds(account).call())
      let staker = await schelling.methods.nodes(yourId).call()
      console.log('stakerepochLastCommitted', Number(staker.epochLastCommitted))
      console.log('stakerepochLastRevealed', Number(staker.epochLastRevealed))
      let secret = await web3.utils.keccak256(await web3.eth.sign(web3.utils.keccak256(account, epoch), account))

      let tx = await reveal(price, secret, account, account)
      console.log(tx.events)
    }
  } else if (state === 2) {
    let res = await getElectedProposer()
    let electedProposer = res[0]
    // let iteration = res[1]
    // let biggestStakerId = res[2]

    let yourId = Number(await schelling.methods.nodeIds(account).call())

    if (electedProposer === yourId && lastProposal < epoch) {
      console.log('lets propose', epoch)
      console.log('electedProposer', electedProposer)
      console.log('yourId', yourId)
      console.log('last propose', lastProposal)
      lastProposal = epoch

      let tx = await propose(account)
      console.log(tx.events)
    }
  }
  // }
})
.on('error', console.error)
}
