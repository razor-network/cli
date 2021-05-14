/* global: console */
let rp = require('request-promise')
let program = require('commander')
let fs = require('fs')
let api = require('./api')
let axios = require('axios')
let _ = require('lodash')

var config = require('./config.json')

let provider = config.provider

console.log('provider', provider)

let web3 = require('./web3')

let lastCommit = -1
let lastReveal = -1
let lastProposal = -1
let lastElection = -1
let lastVerification = -1
let data = []

console.log('web3 version', web3.version)

program
  .version('0.0.3')
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
  .command('vote <account> <password>')
  .alias('v')
  .description('Start monitoring contract, commit, vote, propose and dispute automatically')
  .action(async function (account, password) {
    try {
      await api.login(account, password)

      // priceApi = Number(priceApi)
      await main(account)
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

      let res = await api.transfer(to, amount, from).catch(console.log)
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
      fs.writeFileSync('keys/' + wallet.address + '.json', json, 'utf8', function () {})
      console.log(wallet.address, 'created succesfully. fund this account with ETH and SCH before staking')
    } catch (e) {
      console.error(e)
    }
    process.exit(0)
  })
program
  .command('demo')
  .alias('d')
  .description('sample urls')
  .action(async function () {
    console.log(
      'node index.js j \'https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=MSFT&apikey=demo\' \'Global Quote["05. price"]\' true 1 0x0519cA2C7B556fa3699107EC8348cA2573e90A75 1',
      'https://api.gemini.com/v1/pubticker/ethusd',
      'last')
    process.exit(0)
  })

program
  .command('createJob <url> <selector> <name> <repeat> <fee> <account> <password>')
  .alias('j')
  .description('create oracle query job')
  .action(async function (url, selector, name, repeat, fee, account, password) {
    try {
      await api.login(account, password)

      let res = await api.createJob(url, selector, name, repeat === 'true', fee, account).catch(console.log)
      console.log(res)
      if (res) console.log('succesfully created job')
    } catch (e) {
      console.error(e)
    }
    process.exit(0)
  })

program.parse(process.argv)

let isWatchingEvents = false

async function main (account) {
  web3.eth.subscribe('newBlockHeaders', async function (error, result) {
    if (!error) {
      return
    }
    console.error(error)
  })
    .on('data', function (blockHeader) {
      handleBlock(blockHeader, account)
    })
    .on('error', console.error)
  console.log('subscribed')
  isWatchingEvents = true
}

async function handleBlock (blockHeader, account) {
  try {
    let state = await api.getDelayedState()
    let epoch = await api.getEpoch()
    let yourId = await api.getStakerId(account)

    let balance = Number(await api.getStake(yourId)) / 1e18
    let ethBalance = Number(await web3.eth.getBalance(account)) / 1e18
    console.log('🔲 Block', String(blockHeader.number), '⌛ Epoch', String(epoch), '⏱️  State', String(state), '📒', String(account), '👤 Staker ID'
      , String(yourId)
      , '💰Stake', String(balance), 'Ξ', String(ethBalance))
    if (balance < (await api.getMinStake()) / 1e18) throw new Error('Stake is below minimum required. Cannot vote.')

    if (state === 0) {
      if (lastCommit < epoch) {
        lastCommit = epoch
        let input = await web3.utils.soliditySha3(account, epoch)
        let sig = await api.sign(input, account)
        // console.log('sig', sig)
        // console.log('sig.signature', sig.signature)
        let secret = await web3.utils.soliditySha3(sig)
        let jobs = await api.getActiveJobs()
        console.log('jobs', jobs)
        data = []
        let response
        let datum
        for (let i = 0; i < jobs.length; i++) {
          // if (jobs[i].url === '') break
          // console.log('i, job', i, jobs[i])
          try {
            response = await axios.get(jobs[i].url, {timeout: 60000})
            datum = _.get(response.data, jobs[i].selector)
            if (isNaN(Number(datum))) throw ('Result is not a number', 'jobs[i].url', 'jobs[i].selector', datum, typeof (datum))
            datum = Math.floor(Number(datum) * 100000000)
            data.push(datum)
          } catch (e) {
            console.error(e)
            data.push(0)
          }
        }
        if (data.length === 0) data = [0]
        let tx = await api.commit(data, secret, account)
        console.log(tx.events)
      }
    } else if (state === 1) {
      if (lastReveal < epoch && data !== undefined) {
        console.log('last revealed in epoch', lastReveal)
        lastReveal = epoch
        let yourId = await api.getStakerId(account)
        let staker = await api.getStaker(yourId)
        console.log('stakerepochLastCommitted', Number(staker.epochLastCommitted))
        if (Number(staker.epochLastCommitted) !== epoch) {
          console.log('Commitment for this epoch not found on network. Aborting reveal')
        } else {
          console.log('stakerepochLastRevealed', Number(staker.epochLastRevealed))
          let input = await web3.utils.soliditySha3(account, epoch)
          let sig = await api.sign(input, account)

          let secret = await web3.utils.soliditySha3(sig)
          let tx = await api.reveal(data, secret, account, account)
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
      if (lastVerification < epoch) {
        lastVerification = epoch
        let numProposedBlocks = Number(await api.getNumProposedBlocks(epoch))
        if (numProposedBlocks > 5) numProposedBlocks = 5
        for (let i = 0; i < numProposedBlocks; i++) {
          let proposedBlock = await api.getProposedBlock(epoch, i)

          let medians = proposedBlock[1].map(Number)
          let lowerCutoffs = proposedBlock[2].map(Number)
          let higherCutoffs = proposedBlock[3].map(Number)
          console.log('values proposed in block', medians, lowerCutoffs, higherCutoffs)

          let block = await api.makeBlock()
          console.log('Locally calculated median:', block[0], ' lowerCutoff: ', block[1], ' higherCutoff: ', block[2])
          if (JSON.stringify(medians) !== JSON.stringify(block[0]) ||
            JSON.stringify(lowerCutoffs) !== JSON.stringify(block[1]) ||
            JSON.stringify(higherCutoffs) !== JSON.stringify(block[2])
          ) {
            console.log('WARNING: BLOCK NOT MATCHING WITH LOCAL CALCULATIONS. local values:' + block + 'block values:', medians, lowerCutoffs, higherCutoffs)
            await api.dispute(account)
          } else {
            console.log('Proposed median matches with local calculations. Will not open dispute.')
          }
        }
      }
    }
  } catch (e) {
    console.error(e)
  }
}
