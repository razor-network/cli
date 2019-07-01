/* global: console */

let Web3 = require('web3')
let rp = require('request-promise')
let program = require('commander')
let KrakenClient = require('kraken-api')
let kraken = new KrakenClient()
let fs = require('fs').promises
let { randomHex } = require('web3-utils')
let sleep = require('util').promisify(setTimeout)

// let provider = 'ws://localhost:8546/'
let provider2 = 'wss://rinkeby.infura.io/ws'
let networkid = '4' // rinkeby
let web3 = new Web3(Web3.givenProvider || provider2, null, {})

let schellingBuild = require('./build/contracts/Schelling2.json')
let keys = require('./keys.json')
let schellingAbi = schellingBuild['abi']
let schelling = new web3.eth.Contract(schellingAbi, schellingBuild['networks'][networkid].address,
  {transactionConfirmationBlocks: 1,
    defaultGas: 500000,
    defaultGasPrice: 2000000000})

let simpleTokenBuild = require('./build/contracts/SimpleToken.json')
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

let cmcRequestOptions = {
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
  let keystoreArray = JSON.parse(rawdata)
  let wall = await web3.eth.accounts.wallet.decrypt([keystoreArray], password)
  let pk = wall.accounts[0].privateKey
  let account = await web3.eth.accounts.privateKeyToAccount(pk)
  await web3.eth.accounts.wallet.add(account)
  let from = await web3.eth.accounts.wallet.accounts[0].address
  console.log(from, ' unlocked')
  return (from)
}

program
      .version('0.0.1')
      .description('Razor network')

program
      .command('stake <amount> <address> <password>')
      .alias('s')
      .description('Stake some schells')
      .action(async function (amount, address, password) {
        try {
          await login(address, password)
          let res = await stake(amount, address).catch(console.log)
          if (res) {
            console.log('succesfully staked ', amount, ' schells')
          }
        } catch (e) {
          console.error(e)
        }
        process.exit(0)
      })

program
      .command('unstake <accountId>')
      .alias('u')
      .description('Unstake all schells')
      .action(async function (accountId) {
        try {
          let account = (await web3.eth.personal.getAccounts())[Number(accountId)]
          let res = await unstake(account).catch(console.log)
          if (res) console.log('succesfully unstaked all schells')
        } catch (e) {
          console.error(e)
        }
        process.exit(0)
      })

program
      .command('withdraw <accountId>')
      .alias('w')
      .description('Withdraw all schells. Make sure schells are unstaked and unlocked')
      .action(async function (accountId) {
        try {
          let account = (await web3.eth.personal.getAccounts())[Number(accountId)]
          let res = await withdraw(account).catch(console.log)
          if (res) console.log('succesfully withdrew all schells')
        } catch (e) {
          console.error(e)
        }
        process.exit(0)
      })

program
      .command('vote <api> <account> <password>')
      .alias('v')
      .description('Start monitoring contract, commit, vote, propose and dispute automatically')
      .action(async function (api, account, password) {
        try {
          await login(account, password)

          api = Number(api)
          await main(account, api)
        } catch (e) {
          console.error(e)
        }
      })

program
      .command('transfer <to> <amount> <from> <password>')
      .alias('t')
      .description('transfer schells')
      .action(async function (to, amount, from, password) {
        try {
          await login(from, password)

          let res = await transfer(to, amount, from).catch(console.log)
          if (res) console.log('succesfully transferred')
        } catch (e) {
          console.error(e)
        }
        process.exit(0)
      })

program
        .command('create <password>')
        .alias('c')
        .description('create wallet with given password')
        .action(async function (password) {
          try {
            let wallet = await web3.eth.accounts.create()
            let walletEnc = await web3.eth.accounts.encrypt(wallet.privateKey, password)
            let json = JSON.stringify(walletEnc)
            await fs.writeFile('keys/' + wallet.address + '.json', json, 'utf8', function () {})
            console.log(wallet.address, 'created succesfully. fund this account with ETH and SCH before staking')
          } catch (e) {
            console.error(e)
          }
          process.exit(0)
        })

program.parse(process.argv)

async function getBiggestStakerId () {
  let numStakers = Number(await schelling.methods.numNodes().call())
  // console.log('numStakers', numStakers)
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
  // console.log(nonce)
  // let gas = await simpleToken.methods
  //   .approve(to, amount)
  //   .estimateGas({ from, gas: '6000000'})
  // gas = Math.round(gas * 1.5)

  // console.log(gas)
  console.log('checking allowance...')
  let allowance = await simpleToken.methods.approve(from, to).call()
  console.log('allowance', allowance)
  if (allowance >= amount) {
    console.log('sufficient allowance. No need to increase')
    return
  } else {
    console.log('Sending approve transaction...')
    return simpleToken.methods.approve(to, amount).send({
      from: from,
      nonce: nonce})
  }
}

async function stake (amount, account) {
  let epoch
  let state

  console.log('account', account)
  let balance = Number(await simpleToken.methods.balanceOf(account).call())
  console.log('schell balance', balance / 1e18, 'schells')
  if (balance < amount) throw new Error('Not enough schells to stake')
  let ethBalance = Number(await web3.eth.getBalance(account)) / 1e18
  console.log('ether balance', ethBalance / 1e18, 'eth')

  if (balance < 0.01) throw new Error('Please fund this account with more ether to pay for tx fees')

  let tx = await approve(schelling.address, amount, account)
  if (tx.events) {
    console.log(tx.events)
    if (tx.events.Approval.event !== 'Approval') throw new Error('Approval failed')
  }
  let nonce = await web3.eth.getTransactionCount(account, 'pending')
  // console.log(nonce)
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
    nonce: String(nonce)})
  console.log(tx2.events)
  return (tx2.events.Staked.event === 'Staked')
}

async function unstake (account) {
  let epoch = Number(await schelling.methods.getEpoch.call())
  console.log('epoch', epoch)
  console.log('account', account)
  let balance = Number(await simpleToken.methods.balanceOf(account).call())
  console.log('balance', balance)
  if (balance === 0) throw new Error('balance is 0')
  let nonce = await web3.eth.getTransactionCount(account, 'pending')

  let tx = await schelling.methods.unstake(epoch).send({from: account,
    nonce: String(nonce)})
  console.log(tx.events)
  return (tx.events.Unstaked.event === 'Unstaked')
}

async function withdraw (account) {
  let epoch = Number(await schelling.methods.getEpoch.call())
  console.log('epoch', epoch)
  console.log('account', account)
  let balance = Number(await simpleToken.methods.balanceOf(account).call())
  console.log('balance', balance)
  if (balance === 0) throw new Error('balance is 0')
  let nonce = await web3.eth.getTransactionCount(account, 'pending')

  let tx = await schelling.methods.withdraw(epoch).send({from: account,
    nonce: String(nonce)})
  console.log(tx.events)
  return (tx.events.Unstaked.event === 'Unstaked')
}

async function commit (price, secret, account) {
  if (Number(await schelling.methods.getState().call()) != 0) {
    throw ('Not commit state')
  }
  let nodeId = Number(await schelling.methods.nodeIds(account).call())
  let epoch = Number(await schelling.methods.getEpoch.call())

  if ((await schelling.methods.commitments(epoch, nodeId).call()) != 0) {
    throw ('Already Committed')
  }
  let commitment = web3.utils.soliditySha3(epoch, price, secret)
  let nonce = await web3.eth.getTransactionCount(account, 'pending')
  let tx = await schelling.methods.commit(epoch, commitment).send({'from': account, 'nonce': nonce})
  return tx
}

async function reveal (price, secret, commitAccount, account) {
  if (Number(await schelling.methods.getState().call()) != 1) {
    throw new Error('Not reveal state')
  }
  let nodeId = Number(await schelling.methods.nodeIds(account).call())
  let epoch = Number(await schelling.methods.getEpoch().call())
  console.log('nodeId', nodeId)
  if ((await schelling.methods.commitments(epoch, nodeId).call()) === 0) {
    throw new Error('Did not commit')
  }
  let revealed = await schelling.methods.votes(epoch, nodeId).call()
  // console.log('revealed', revealed)
  let voted = revealed.vote
  // console.log('voted', voted)
  if (voted !== undefined) {
    throw new Error('Already Revealed', voted)
  }

  // console.log('epoch', epoch)
  console.log('revealing vote for epoch', Number(await schelling.methods.getEpoch().call()), 'price', price, 'secret', secret, 'commitAccount', commitAccount)
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
  // console.log('biggestStakerId', biggestStakerId)
  // console.log('numNodes', numNodes)
  for (let j = 0; ; j++) {
 // iternation

    for (let k = 1; k <= numNodes; k++) { // node
      isElectedProposer = await schelling.methods.isElectedProposer(j, biggestStakerId, k).call()
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
    // console.log(i, 'voted', vote)
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
  return (block)
}

async function makeBlock () {
  let res = await getSortedVotes()
  let sortedVotes = res[1]
  console.log('sortedVotes', sortedVotes)
  let epoch = Number(await schelling.methods.getEpoch().call())

  let totalStakeRevealed = Number(await schelling.methods.totalStakeRevealed(epoch).call())
  // console.log('totalStakeRevealed', totalStakeRevealed)
  let medianWeight = Math.floor(totalStakeRevealed / 2)
  // console.log('medianWeight', medianWeight)

  let i = 0
  let median = 0
  let weight = 0
  for (i = 0; i < sortedVotes.length; i++) {
    weight += sortedVotes[i][1]
    // console.log('weight', weight)
    if (weight > medianWeight && median === 0) median = sortedVotes[i][0]
  }
  return (median)
}

async function propose (account) {
  if (Number(await schelling.methods.getState().call()) != 2) {
    throw ('Not propose state')
  }
  let nodeId = Number(await schelling.methods.nodeIds(account).call())
  let epoch = Number(await schelling.methods.getEpoch().call())
  // console.log('epoch', epoch)
  let getBlock = await schelling.methods.blocks(epoch).call()
  if (getBlock) {
    let proposerId = Number(getBlock.proposerId)
    // console.log('proposerId', proposerId)
    if (proposerId === nodeId) {
      throw new Error('Already proposed')
    }
  }
  if (Number(await schelling.methods.getState().call()) != 2) {
    throw ('Not propose state')
  }
  // let numNodes = Number(await schelling.methods.numNodes().call())
  // console.log('numNodes', numNodes)

  let res = await getElectedProposer()
  let electedProposer = res[0]
  let iteration = res[1]
  let biggestStakerId = res[2]
  // console.log('biggestStakerId', biggestStakerId)
  // console.log('electedProposer, iteration', electedProposer, iteration)
  let block = await makeBlock()
  // console.log('block', block)
  let median = block
  console.log('epoch, median, electedProposer, iteration, biggestStakerId', epoch, median, electedProposer, iteration, biggestStakerId)
  const nonce = await web3.eth.getTransactionCount(account, 'pending')
  let tx = await schelling.methods.propose(epoch, median, iteration, biggestStakerId).send({'from': account, 'nonce': nonce})
  return tx
}

// automatically calculate alternative block and submit
async function dispute (account) {
  let epoch = Number(await schelling.methods.getEpoch().call())
  let res = await getSortedVotes()
  let sortedVotes = res[0]
  let iter = Math.ceil(sortedVotes.length / 1000)
  for (let i = 0; i < iter; i++) {
    console.log(epoch, sortedVotes.slice(i * 1000, (i * 1000) + 1000))
    await schelling.methods.giveSorted(epoch, sortedVotes.slice(i * 1000, (i * 1000) + 1000)).send({from: account,
      nonce: String(nonce)})
  }
  const nonce = await web3.eth.getTransactionCount(account, 'pending')

  return schelling.methods.proposeAlt(epoch).send({from: account,
    nonce: String(nonce)})
}

async function getPrice (api) {
  if (api === 0) {
    return rp(cmcRequestOptions).then(response => {
      let prr = response.data.ETH.quote.USD.price
      if (!prr) return getPrice(1)
      prr = Math.floor(Number(prr) * 100)
      console.log('CM price', prr)
      return prr
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
  web3.eth.subscribe('newBlockHeaders', async function (error, result) {
    if (!error) {
      console.log(result)
      return
    }
    throw (error)
  })
.on('data', async function (blockHeader) {
  // commit
  try {
    let state = Number(await schelling.methods.getState().call())
    let epoch = Number(await schelling.methods.getEpoch().call())
    let yourId = Number(await schelling.methods.nodeIds(account).call())

    let balance = Number((await schelling.methods.nodes(yourId).call()).stake)
    let ethBalance = Number(await web3.eth.getBalance(account)) / 1e18
    console.log('Ethereum block #', blockHeader.number, 'epoch', epoch, 'state', state, 'api', api, 'account', account, 'nodeId', yourId, 'Staked Shells', balance, 'Ether balance', ethBalance)
    if (balance < Number((await schelling.methods.c().call()).MIN_STAKE)) throw new Error('Stake is below minimum required. Cannot vote.')

    if (state === 0) {
      if (lastCommit < epoch) {
        lastCommit = epoch
        price = await getPrice(api)
        let input = await web3.utils.soliditySha3(account, epoch)
        let sig = await web3.eth.sign(input, account)

        let secret = await web3.utils.soliditySha3(sig.signature)

        let tx = await commit(price, secret, account)
        console.log(tx.events)
      }
    } else if (state === 1) {
      if (lastReveal < epoch && price !== undefined) {
        console.log('last revealed in epoch', lastReveal)
        lastReveal = epoch
        let yourId = Number(await schelling.methods.nodeIds(account).call())
        let staker = await schelling.methods.nodes(yourId).call()
        console.log('stakerepochLastCommitted', Number(staker.epochLastCommitted))
        if (Number(staker.epochLastCommitted) !== epoch) {
          console.log('Commitment for this epoch not found on mainnet. Aborting reveal')
        } else {
          console.log('stakerepochLastRevealed', Number(staker.epochLastRevealed))
          let input = await web3.utils.soliditySha3(account, epoch)
          let sig = await web3.eth.sign(input, account)

          let secret = await web3.utils.soliditySha3(sig.signature)
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
          console.log('Proposing block...')
          lastProposal = epoch

          let tx = await propose(account)
          console.log(tx.events)
        }
      }
    } else if (state === 3) {
      if (lastVerification < epoch) {
        lastVerification = epoch
        let proposedBlock = await getBlock(epoch)
      // console.log('proposedBlock', proposedBlock)

        let median = Number(proposedBlock.median)
        console.log('Median proposed in block', median)

        let block = await makeBlock()
        console.log('Locally calculated median', block)
        if (median !== block) {
          console.log('WARNING: BLOCK NOT MATCHING WITH LOCAL CALCULATIONS. local median:' + block + 'block median:', median)
          dispute(account)
        } else {
          console.log('Proposed median mathes with local calculations. Will not open dispute.')
        }
      }
    }
  } catch (e) {
    console.error(e)
  }
})
.on('error', console.error)
}
