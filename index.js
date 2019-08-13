/* global: console */

let Web3 = require('web3')
let rp = require('request-promise')
let program = require('commander')
let KrakenClient = require('kraken-api')
let kraken = new KrakenClient()
let fs = require('fs').promises
let sleep = require('util').promisify(setTimeout)
let api = require('./api')

let provider = 'ws://localhost:8545/'
// let provider2 = 'wss://rinkeby.infura.io/ws'
let networkid = '420' // rinkeby
// let networkid = '4' // rinkeby
let web3 = new Web3(provider, null, {})

let keys = require('./keys.json')

let priceEth
let priceBtc
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

let geminiBtcRequestOptions = {
  method: 'GET',
  uri: 'https://api.gemini.com/v1/pubticker/btcusd',
  json: true,
  gzip: true
}
console.log('web3 version', web3.version)

program
      .version('0.0.2')
      .description('Razor network')

program
      .command('stake <amount> <address> <password>')
      .alias('s')
      .description('Stake some schells')
      .action(async function (amount, address, password) {
        try {
          await api.login(address, password)
          let res = await api.stake(amount, address).catch(console.log)
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
          let res = await api.unstake(account).catch(console.log)
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
          let res = await api.withdraw(account).catch(console.log)
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
      .action(async function (priceApi, account, password) {
        try {
          await api.login(account, password)

          priceApi = Number(priceApi)
          await main(account, priceApi)
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
          await api.login(from, password)

          let res = await api.ransfer(to, amount, from).catch(console.log)
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

async function getEthPrice (priceApi) {
  if (priceApi === 0) {
    return rp(cmcRequestOptions).then(response => {
      let prr = response.data.ETH.quote.USD.price
      if (!prr) return getEthPrice(1)
      prr = Math.floor(Number(prr) * 100)
      console.log('CM price', prr)
      return prr
    }).catch((err) => {
      console.log('API call error:', err.message)
      console.log('Trying API 1')
      return getEthPrice(1)
    })
  } else if (priceApi === 1) {
    return rp(geminiRequestOptions).then(response => {
      let prr = response.last
      if (!prr) return getEthPrice(2)
      prr = Math.floor(Number(prr) * 100)
      console.log('Gemini price', prr)
      return prr
    }).catch((err) => {
      console.log('API call error:', err.message)
      console.log('Trying API 2')
      return getEthPrice(2)
    })
  } else {
    try {
      let prr = await kraken.api('Ticker', { pair: 'XETHZUSD' })
      prr = prr.result.XETHZUSD.c
      if (!prr) return getEthPrice(0)
      prr = Math.floor(Number(prr[0]) * 100)
      console.log('Kraken Price', prr)
      return prr
    } catch (e) {
      console.log('Trying API 1')
      return getEthPrice(1)
    }
  }
}

async function getBtcPrice (priceApi) {
  if (priceApi === 0) {
    return rp(cmcRequestOptions).then(response => {
      let prr = response.data.BTC.quote.USD.price
      if (!prr) return getBtcPrice(1)
      prr = Math.floor(Number(prr) * 100)
      console.log('CM btc price', prr)
      return prr
    }).catch((err) => {
      console.log('API call error:', err.message)
      console.log('Trying API 1')
      return getBtcPrice(1)
    })
  } else if (priceApi === 1) {
    return rp(geminiBtcRequestOptions).then(response => {
      let prr = response.last
      if (!prr) return getBtcPrice(2)
      prr = Math.floor(Number(prr) * 100)
      console.log('Gemini btc price', prr)
      return prr
    }).catch((err) => {
      console.log('API call error:', err.message)
      console.log('Trying API 2')
      return getBtcPrice(2)
    })
  } else {
    try {
      let prr = await kraken.api('Ticker', { pair: 'XXBTZUSD' })
      prr = prr.result.XXBTZUSD.c
      if (!prr) return getBtcPrice(0)
      prr = Math.floor(Number(prr[0]) * 100)
      console.log('Kraken btc Price', prr)
      return prr
    } catch (e) {
      console.log('Trying API 1')
      return getBtcPrice(1)
    }
  }
}
async function main (account, priceApi) {
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
    let state = await api.getState()
    let epoch = await api.getEpoch()
    let yourId = await api.getStakerId(account)

    let balance = await api.getStake(yourId)
    let ethBalance = Number(await web3.eth.getBalance(account)) / 1e18
    console.log('Ethereum block #', blockHeader.number, 'epoch', epoch, 'state', state, 'priceApi', priceApi, 'account', account, 'stakerId', yourId, 'Staked Shells', balance, 'Ether balance', ethBalance)
    if (balance < await api.getMinStake()) throw new Error('Stake is below minimum required. Cannot vote.')

    if (state === 0) {
      if (lastCommit < epoch) {
        lastCommit = epoch
        priceEth = await getEthPrice(api)
        priceBtc = await getBtcPrice(api)
        let input = await web3.utils.soliditySha3(account, epoch)
        let sig = await api.sign(input, account)

        let secret = await web3.utils.soliditySha3(sig.signature)

        let tx = await api.commit([priceEth, priceBtc], secret, account)
        console.log(tx.events)
      }
    } else if (state === 1) {
      if (lastReveal < epoch && priceEth !== undefined) {
        console.log('last revealed in epoch', lastReveal)
        lastReveal = epoch
        let yourId = await api.getStakerId(account)
        let staker = await api.getStaker(yourId)
        console.log('stakerepochLastCommitted', Number(staker.epochLastCommitted))
        if (Number(staker.epochLastCommitted) !== epoch) {
          console.log('Commitment for this epoch not found on mainnet. Aborting reveal')
        } else {
          console.log('stakerepochLastRevealed', Number(staker.epochLastRevealed))
          let input = await web3.utils.soliditySha3(account, epoch)
          let sig = await api.sign(input, account)

          let secret = await web3.utils.soliditySha3(sig.signature)
          let tx = await api.reveal([priceEth, priceBtc], secret, account, account)
          console.log(tx)
        }
      }
    } else if (state === 2) {
      if (lastElection < epoch) {
        lastElection = epoch

        if (lastProposal < epoch) {
          console.log('Proposing block...')
          lastProposal = epoch

          let tx = await api.propose(account)
          console.log(tx)
        }
      }
    } else if (state === 3) {
      // if (lastVerification < epoch) {
      //   lastVerification = epoch
      //   let blockMedians = await api.getBlockMedians(epoch)
      // // console.log('proposedBlock', proposedBlock)
      //
      //   let median = Number(proposedBlock.median)
      //   console.log('Median proposed in block', median)
      //
      //   let block = await api.makeBlock()
      //   console.log('Locally calculated median', block)
      //   if (medians !== block) {
      //     console.log('WARNING: BLOCK NOT MATCHING WITH LOCAL CALCULATIONS. local median:' + block + 'block medians:', medians)
      //     await api.dispute(account)
      //   } else {
      //     console.log('Proposed median matches with local calculations. Will not open dispute.')
      //   }
      // }
    }
  } catch (e) {
    console.error(e)
  }
})
.on('error', console.error)
}
