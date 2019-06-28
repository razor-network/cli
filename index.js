/* global: console */
// apiid 0 = CMC
// apiid 1 = kraken
// apiid 2 = gemini
// validate block in dispute state, not propose state

let Web3 = require('web3')
let rp = require('request-promise')
let program = require('commander')
let KrakenClient = require('kraken-api')
let kraken = new KrakenClient()
let fs = require('fs').promises
let { randomHex } = require('web3-utils')
// let provider = 'ws://localhost:8546/'
let provider2 = 'wss://rinkeby.infura.io/ws'
let networkid = '4' // rinkeby
let web3 = new Web3(Web3.givenProvider || provider2, null, {})

let sleep = require('util').promisify(setTimeout)

let schellingBuild = require('../contracts/build/contracts/Schelling2.json')
let keys = require('./keys.json')
let schellingAbi = schellingBuild['abi']
let schelling = new web3.eth.Contract(schellingAbi, schellingBuild['networks'][networkid].address,
  {transactionConfirmationBlocks: 1,
    defaultGas: 500000,
    defaultGasPrice: 2000000000})

let simpleTokenBuild = require('../contracts/build/contracts/SimpleToken.json')
let simpleTokenAbi = simpleTokenBuild['abi']
let simpleToken = new web3.eth.Contract(simpleTokenAbi, simpleTokenBuild['networks'][networkid].address,
  {transactionConfirmationBlocks: 1,
    defaultGas: 500000,
    defaultGasPrice: 2000000000})

let price
let lastCommit = -1
let lastReveal = -1
let lastProposal = -1
let lastElection = -1
let lastVerification = -1

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

async function login (address, password) {
  await web3.eth.accounts.wallet.create(0, randomHex(32))
  let rawdata = await fs.readFile('keys/' + address + '.json')
  // console.log(rawdata)

  let keystoreArray = JSON.parse(rawdata)
  // console.log(keystoreArray)
  let wall = await web3.eth.accounts.wallet.decrypt([keystoreArray], password)
  // console.log(wall.accounts[0].privateKey)

  let pk = wall.accounts[0].privateKey
  let account = await web3.eth.accounts.privateKeyToAccount(pk)
  await web3.eth.accounts.wallet.add(account)
  let from = await web3.eth.accounts.wallet.accounts[0].address
  console.log(from, ' unlocked')
  return (from)
}

program
  .version('0.0.1')
  .description('Schelling network')

program
  .command('stake <amount> <address> <password>')
  .alias('s')
  .description('Stake some schells')
  .action(async function (amount, address, password) {
    // let account = (await web3.eth.personal.getAccounts())[Number(accountId)]
    await login(address, password)
    let res = await stake(amount, address).catch(console.log)
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
  .command('vote <api> <account> <password>')
  .alias('v')
  .description('Start monitoring contract, commit,vote and propose automatically')
  .action(async function (api, account, password) {
    await login(account, password)

    // let account = (await web3.eth.personal.getAccounts())[Number(accountId)]
    api = Number(api)
    await main(account, api).catch(console.log)
  })

program
    .command('transfer <to> <amount> <from> <password>')
    .alias('t')
    .description('transfer schells')
    .action(async function (to, amount, from, password) {
      await login(from, password)
      // let accountFrom = (await web3.eth.personal.getAccounts())[Number(from)]
      // let accountTo = (await web3.eth.personal.getAccounts())[Number(to)]

      let res = await transfer(to, amount, from).catch(console.log)
      if (res) console.log('succesfully transferred')
      process.exit(0)
    })

program.command('create <password>')
        .alias('c')
        .description('create wallet with given password')
        .action(async function (password) {
          let wallet = await web3.eth.accounts.create()
          let walletEnc = await web3.eth.accounts.encrypt(wallet.privateKey, password)
          let json = JSON.stringify(walletEnc)
          await fs.writeFile('keys/' + wallet.address + '.json', json, 'utf8', function () {})
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
  const nonce = await web3.eth.getTransactionCount(from, 'pending')
  console.log(nonce)
  // let gas = await simpleToken.methods
  //   .approve(to, amount)
  //   .estimateGas({ from, gas: '6000000'})
  // gas = Math.round(gas * 1.5)

  // console.log(gas)

  let res = await simpleToken.methods.transfer(to, amount).send({ from: from,
    nonce: nonce})
  console.log(res)
}

async function approve (to, amount, from) {
  const nonce = await web3.eth.getTransactionCount(from, 'pending')
  console.log(nonce)
  // let gas = await simpleToken.methods
  //   .approve(to, amount)
  //   .estimateGas({ from, gas: '6000000'})
  // gas = Math.round(gas * 1.5)

  // console.log(gas)

  return simpleToken.methods.approve(to, amount).send({
    from: from,
    nonce: nonce})
}

async function stake (amount, account) {
  let epoch
  let state

  console.log('account', account)
  let balance = Number(await simpleToken.methods.balanceOf(account).call())
  console.log('balance', balance / 1e18, 'schells')
  if (balance < amount) throw new Error('Not enough schells to stake')
  console.log('Sending approve transaction...')
  let tx = await approve(schelling.address, amount, account)
  console.log(tx.events)
  if (tx.events.Approval.event !== 'Approval') throw new Error('Approval failed')

  let nonce = await web3.eth.getTransactionCount(account, 'pending')
  console.log(nonce)
  // let gas = await schelling.methods
  //   .stake(epoch, amount)
  //   .estimateGas({ account, gas: '4000000'})
  // gas = Math.round(gas * 1.1)

  // console.log(gas)
  while (true) {
    epoch = Number(await schelling.methods.getEpoch.call())
    state = Number(await schelling.methods.getState.call())
    console.log('epoch', epoch)
    console.log('state', state)
    if (state !== 0) {
      console.log('Can only stake during state 0 (commit). Retrying in 10 seconds...')
      await sleep(10000)
    } else break
  }
  console.log('Sending stake transaction...')

  let tx2 = await schelling.methods.stake(epoch, amount).send({
    from: account,
    nonce: String(nonce),
    gas: String(2000000)})
  console.log(tx2.events)
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
  let nonce = await web3.eth.getTransactionCount(account, 'pending')
  let tx = await schelling.methods.commit(epoch, commitment).send({'from': account, 'nonce': nonce})
  return tx
}

async function reveal (price, secret, commitAccount, account) {
  if (Number(await schelling.methods.getState().call()) != 1) {
    throw ('Not reveal state')
  }
  let node = Number(await schelling.methods.nodeIds(account).call())
  console.log('node', node)
  let epoch = Number(await schelling.methods.getEpoch().call())
  console.log('epoch', epoch)
  // let commitment = await schelling.methods.commitments(epoch, node).call()
  // commitments[epoch][thisNodeId]
  // console.log('commitment', commitment)
  // console.log('price', price)
  // let recalc = web3.utils.soliditySha3(epoch, price, secret)
  // console.log('recalc', recalc)
  console.log('revealing vote for epoch', Number(await schelling.methods.getEpoch().call()), 'price', price, 'secret', secret, 'commitAccount', commitAccount)
  // let commitment = web3.utils.soliditySha3((Number(await schelling.getEpoch())), amount, '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9111')
  let nonce = await web3.eth.getTransactionCount(account, 'pending')
  let tx = await schelling.methods.reveal(epoch, price, secret, commitAccount).send({'from': account, 'nonce': nonce})
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
      // console.log('isElectedProposer', isElectedProposer)
      if (isElectedProposer) {
        let node = await schelling.methods.nodes(k).call()
        iteration = j
        electedProposer = k
        console.log('iteration', iteration, 'electedProposer', electedProposer, 'nodeId', Number(node.id), 'stake', Number(node.stake))
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
    let vote = Number((await schelling.methods.votes(epoch, i).call()).value)
    console.log(i, 'voted', vote)
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

async function getBlock (epoch) {
  let block = await schelling.methods.blocks(epoch).call()
  // console.log('block', block)
  return (block)
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

  let i = 0
  let median = 0
  let weight = 0
  for (i = 0; i < sortedVotes.length; i++) {
    weight += sortedVotes[i][1]
    console.log('weight', weight)
    if (weight > medianWeight && median === 0) median = sortedVotes[i][0]
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
  const nonce = await web3.eth.getTransactionCount(account, 'pending')
  let tx = await schelling.methods.propose(epoch, median, iteration, biggestStakerId).send({'from': account, 'nonce': nonce})
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

async function main (account, api) {
  // schelling.events.Proposed().on('data', async function (data) {
  //   console.log('gotcha')
  //   console.log(data)
  //   let median = Number(data.returnValues.median)
  //   // let twoFive = Number(data.returnValues.twoFive)
  //   // let sevenFive = Number(data.returnValues.sevenFive)
  //   // let stakeGettingPenalty = Number(data.returnValues.stakeGettingPenalty)
  //   // let stakeGettingReward = Number(data.returnValues.stakeGettingReward)
  //
  //   let block = await makeBlock()
  //   console.log('block', block)
  //   // return ([median, twoFive, sevenFive, stakeGettingPenalty, stakeGettingReward])
  //   if (median !== block
  //     // ||
  //       // twoFive !== block[1] ||
  //       // sevenFive !== block[2] ||
  //       // stakeGettingPenalty != block[3] ||
  //       // stakeGettingReward != block[4]
  //     ) {
  //     console.log('WARNING: BLOCK NOT MATCHING WITH LOCAL CALCULATIONS. local median:' + block + 'block median:', median)
  //   }
  // })
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
  // console.log('You have staked ', balance, ' schells')
  console.log('Ethereum block #', blockHeader.number, 'epoch', epoch, 'state', state, 'account', account, 'nodeId', yourId, 'stakedBalance', balance)
  if (balance < Number((await schelling.methods.c().call()).MIN_STAKE)) throw new Error('Stake is below minimum required. Cannot vote.')

  if (state === 0) {
    if (lastCommit < epoch) {
      lastCommit = epoch
      price = await getPrice(api)
      // console.log('lets commit', price)
      // console.log('last commit', epoch)
      let input = await web3.utils.soliditySha3(account, epoch)
      // console.log('input', input)
      let sig = await web3.eth.sign(input, account)
      // console.log('sig', sig.signature)

      let secret = await web3.utils.soliditySha3(sig.signature)
      // console.log('secret', secret)

      let tx = await commit(price, secret, account)
      console.log(tx.events)
    }
  } else if (state === 1) {
    if (lastReveal < epoch && lastCommit === epoch) {
      console.log('last revealed in epoch', lastReveal)
      // console.log('lets reveal')
      lastReveal = epoch
      let yourId = Number(await schelling.methods.nodeIds(account).call())
      let staker = await schelling.methods.nodes(yourId).call()
      console.log('stakerepochLastCommitted', Number(staker.epochLastCommitted))
      if (Number(staker.epochLastCommitted) !== epoch) {
        console.log('Commitment for this epoch not found on mainnet. Aborting reveal')
      } else {
        console.log('stakerepochLastRevealed', Number(staker.epochLastRevealed))
        let input = await web3.utils.soliditySha3(account, epoch)
        // console.log('input', input)
        let sig = await web3.eth.sign(input, account)
        // console.log('sig', sig.signature)

        let secret = await web3.utils.soliditySha3(sig.signature)
        // console.log('secret', secret)
        let tx = await reveal(price, secret, account, account)
        console.log(tx.events)
      }
    }
  } else if (state === 2) {
    if (lastElection < epoch) {
      lastElection = epoch
      let res = await getElectedProposer()
      let electedProposer = res[0]

      let yourId = Number(await schelling.methods.nodeIds(account).call())

      if (electedProposer === yourId && lastProposal < epoch) {
        console.log('lets propose', epoch)
      // console.log('electedProposer', electedProposer)
      // console.log('yourId', yourId)
      // console.log('last propose', lastProposal)
        lastProposal = epoch

        let tx = await propose(account)
        console.log(tx.events)
      }
    }
  } else if (state === 3) {
    if (lastVerification < epoch) {
      lastVerification = epoch
      let proposedBlock = await getBlock(epoch)
      console.log('proposedBlock', proposedBlock)

      let median = Number(proposedBlock.median)
      console.log('median', median)
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
      } else {
        console.log('updated block mathes with local calculations. Will not open dispute.')
      }
    }
  }
})
.on('error', console.error)
}
