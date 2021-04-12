let Web3 = require('web3')
let { randomHex } = require('web3-utils')
let fs = require('fs')
let sleep = require('util').promisify(setTimeout)
var config = require('./config.json')
let axios = require('axios')

const TOTAL_SUPPLY = 1000000000

let infuraKey = config.infuraKey
let provider = config.httpProvider
let networkid = config.networkid
let numBlocks = config.numBlocks
let gethHttpProvider = config.geth.httpProvider
// let provider = 'http://35.188.201.171:8545'

// let provider = 'https://rinkeby.infura.io/v3/' + infuraKey

// let networkid = '420' // testnet
// let networkid = '4' // rinkeby
let web3 = new Web3(provider, null, {})
let web3Geth = new Web3(gethHttpProvider, null, {})

let merkle = require('@razor-network/merkle')
let stakeManagerBuild = require('./build/contracts/StakeManager.json')
let stateManagerBuild = require('./build/contracts/StateManager.json')
let blockManagerBuild = require('./build/contracts/BlockManager.json')
let voteManagerBuild = require('./build/contracts/VoteManager.json')
let jobManagerBuild = require('./build/contracts/JobManager.json')
let delegatorBuild = require('./build/contracts/Delegator.json')
let constantsBuild = require('./build/contracts/Constants.json')
let randomBuild = require('./build/contracts/Random.json')
let stakeManager = new web3.eth.Contract(stakeManagerBuild['abi'], stakeManagerBuild['networks'][networkid].address,
  {transactionConfirmationBlocks: 1,
    gas: 8000000,
  gasPrice: 10000000000})
let stateManager = new web3.eth.Contract(stateManagerBuild['abi'], stateManagerBuild['networks'][networkid].address,
  {transactionConfirmationBlocks: 1,
    gas: 8000000,
  gasPrice: 10000000000})
let blockManager = new web3.eth.Contract(blockManagerBuild['abi'], blockManagerBuild['networks'][networkid].address,
  {transactionConfirmationBlocks: 1,
    gas: 8000000,
  gasPrice: 10000000000})
let voteManager = new web3.eth.Contract(voteManagerBuild['abi'], voteManagerBuild['networks'][networkid].address,
  {transactionConfirmationBlocks: 1,
    gas: 8000000,
  gasPrice: 10000000000})
let jobManager = new web3.eth.Contract(jobManagerBuild['abi'], jobManagerBuild['networks'][networkid].address,
  {transactionConfirmationBlocks: 1,
    gas: 8000000,
  gasPrice: 10000000000})
let constants = new web3.eth.Contract(constantsBuild['abi'], constantsBuild['networks'][networkid].address,
  {transactionConfirmationBlocks: 1,
    gas: 8000000,
  gasPrice: 10000000000})
let random = new web3.eth.Contract(randomBuild['abi'], randomBuild['networks'][networkid].address,
  {transactionConfirmationBlocks: 1,
    gas: 8000000,
  gasPrice: 10000000000})

// Geth
let gethStateManager = new web3Geth.eth.Contract(stateManagerBuild['abi'], stateManagerBuild['networks'][networkid].address,
  {transactionConfirmationBlocks: 1,
    gas: 8000000,
  gasPrice: 10000000000}) 
let gethStakeManager = new web3Geth.eth.Contract(stakeManagerBuild['abi'], stakeManagerBuild['networks'][networkid].address,
  {transactionConfirmationBlocks: 1,
    gas: 8000000,
  gasPrice: 10000000000})
let gethJobManager = new web3Geth.eth.Contract(jobManagerBuild['abi'], jobManagerBuild['networks'][networkid].address,
  {transactionConfirmationBlocks: 1,
    gas: 8000000,
  gasPrice: 10000000000})
let gethVoteManager = new web3Geth.eth.Contract(voteManagerBuild['abi'], voteManagerBuild['networks'][networkid].address,
  {transactionConfirmationBlocks: 1,
    gas: 8000000,
  gasPrice: 10000000000})
let gethBlockManager = new web3Geth.eth.Contract(blockManagerBuild['abi'], blockManagerBuild['networks'][networkid].address,
  {transactionConfirmationBlocks: 1,
    gas: 8000000,
  gasPrice: 10000000000})

const isInfura = (provider) => provider === 'infura'

const tokenAddress = fs.readFileSync('.tokenAddress').toString().trim()
let simpleTokenBuild = require('./build/contracts/Razor.json')
let simpleTokenAbi = simpleTokenBuild['abi']
let simpleToken = new web3.eth.Contract(simpleTokenAbi, tokenAddress,
  {transactionConfirmationBlocks: 1,
    gas: 8000000,
  gasPrice: 10000000000})



async function login (address, password) {
  await web3.eth.accounts.wallet.create(0, randomHex(32))
  let rawdata = await fs.readFileSync('keys/' + address + '.json')
  let keystoreArray = JSON.parse(rawdata)
  let wall = await web3.eth.accounts.wallet.decrypt([keystoreArray], password)
  let pk = wall[0].privateKey
  let account = await web3.eth.accounts.privateKeyToAccount(pk)
  await web3.eth.accounts.wallet.add(account)
  let from = await wall[0].address
  console.log(from, ' unlocked')
  return ([from, pk])
}

async function createJob (url, selector, repeat, eth, account) {
  let nonce = await web3.eth.getTransactionCount(account, 'pending')

  return jobManager.methods.createJob(url, selector, repeat).send({from: account, nonce: String(nonce), value: eth})
}

async function getActiveJobs () {
  let numJobs = Number(await jobManager.methods.numJobs().call())
  let job
  let jobs = []
  let epoch = Number(await stateManager.methods.getEpoch().call())
  for (let i = 1; i <= numJobs; i++) {
    job = await jobManager.methods.jobs(i).call()
    if (!job.fulfilled && Number(job.epoch) < epoch) {
      jobs.push(job)
    }
  }
  return jobs
}

async function getJobs (provider) {
  let manager = isInfura(provider) ? jobManager : gethJobManager

  let numJobs = Number(await manager.methods.numJobs().call())
  let job
  let jobs = []  // let epoch = Number(await stateManager.methods.getEpoch().call())
  for (let i = 1; i <= numJobs; i++) {
    job = await manager.methods.getJob(i).call()
    job.id = i
    jobs.push(job)
  }

  return jobs
}
async function getNumJobs () {
  let numJobs = Number(await jobManager.methods.numJobs().call())

  return numJobs
}
async function getResult (id) {
  let result = Number(await jobManager.methods.getResult(id).call())
  return result
}

async function getJob (id) {
  let result = await jobManager.methods.getJob(id).call()
  return result
}

async function getStakers () {
  let numStakers = Number(await stakeManager.methods.getNumStakers().call())
  let res = []
  // let epoch = Number(await stateManager.methods.getEpoch().call())
  for (let i = 1; i <= numStakers; i++) {
    staker = await stakeManager.methods.getStaker(i).call()

    res.push({'stakerId': staker[0],
      'address': staker[1],
      'stake': staker[2]
    })
  }
  return res
}

async function getJobValues (jobId, provider) {
  let web3Provider = web3Geth
  let manager = gethJobManager
  if (isInfura(provider)) {
    web3Provider = web3
    manager = jobManager
  }

  let blockNumber = await web3Provider.eth.getBlockNumber()

  let fulfills = await manager.getPastEvents('JobReported', {
    fromBlock: Math.max(0, Number(blockNumber) - 1000),
    toBlock: 'latest'
  })
  // console.log('fulfills', fulfills)
  let values = []
  for (let i = 0; i < fulfills.length; i++) {
    if (Number(fulfills[i].returnValues.id) === Number(jobId)) values.push(fulfills[i].returnValues)
  }
  return values
}

async function getVotesLastEpoch (jobId, provider) {
  let web3Provider = web3Geth
  let providerStakeManager = gethStakeManager
  let providerVoteManager = gethVoteManager
  if (isInfura(provider)) {
    web3Provider = web3
    providerStakeManager = stakeManager
    providerVoteManager = voteManager
  }
  
  let blockNumber = await web3Provider.eth.getBlockNumber()
  let epoch = Number(await getEpoch(provider)) - 1
  let numStakers = Number(await providerStakeManager.methods.getNumStakers().call())
  let vote
  let votes = []
  let staker

  for (let i = 1; i <= numStakers; i++) {
    vote = await providerVoteManager.methods.getVote(epoch, i, jobId - 1).call()
    staker = (await providerStakeManager.methods.getStaker(i).call())
    // console.log(staker)
    if (Number(vote.value) > 0) {
      votes.push({staker: staker._address, id: staker.id, value: Number(vote.value), weight: vote.weight})
    }
  }
  return votes
}

async function getVotingEvents (jobId, provider) {
  let web3Provider = web3Geth
  let providerStakeManager = gethStakeManager
  let providerVoteManager = gethVoteManager
  if (isInfura(provider)) {
    web3Provider = web3
    providerStakeManager = stakeManager
    providerVoteManager = voteManager
  }
 
  let blockNumber = await web3Provider.eth.getBlockNumber()
  // let epoch = Number(await getEpoch()) - 1
  let events = await providerVoteManager.getPastEvents('allEvents', {
    fromBlock: Math.max(0, Number(blockNumber) - 1000),
    toBlock: 'latest'
  })
  // console.log(events[2].returnValues)
  let res = []
  let value
  let staker
  let timestamp
  for (let i = 0; i < events.length; i++) {
    staker = (await providerStakeManager.methods.getStaker(events[i].returnValues.stakerId).call())[1]
    timestamp = events[i].returnValues.timestamp
    if (events[i].event === 'Committed') {
      value = events[i].returnValues.commitment
      res.push({epoch: events[i].returnValues.epoch, staker: staker, action: events[i].event, value: value, timestamp: timestamp })
    } else if (events[i].event === 'Revealed') {
      value = events[i].returnValues.values
      if (jobId) {
        res.push({epoch: events[i].returnValues.epoch, staker: staker, action: events[i].event, value: value[jobId - 1], timestamp: timestamp })
      } else {
        res.push({epoch: events[i].returnValues.epoch, staker: staker, action: events[i].event, value: value, timestamp: timestamp })
      }
    }
  }

  return res
}

async function getStakingEvents (provider) {
  let web3Provider = web3Geth
  let manager = gethStakeManager
  if (isInfura(provider)) {
    web3Provider = web3
    manager = stakeManager
  }

  let blockNumber = await web3Provider.eth.getBlockNumber()
  // let epoch = Number(await getEpoch()) - 1
  let events = await manager.getPastEvents('allEvents', {
    fromBlock: Math.max(0, Number(blockNumber) - 1000),
    // fromBlock: 0,
    toBlock: 'latest'
  })

  // event Staked(uint256 epoch, uint256 stakerId, uint256 amount, uint256 timestamp)
  // event Unstaked(uint256 epoch, uint256 stakerId, uint256 amount, uint256 timestamp)
  // event Withdrew(uint256 epoch, uint256 stakerId, uint256 amount, uint256 timestamp)

  // console.log(events[2].returnValues)
  let res = []
  let value
  let staker
  let timestamp
  for (let i = 0; i < events.length; i++) {
    if (events[i].event === 'WriterAdded' || events[i].event === 'StakeGettingRewardChange') continue
    if (events[i].returnValues.stakerId !== undefined) {
      staker = (await manager.methods.getStaker(events[i].returnValues.stakerId).call())[1]
    }
    let data = events[i].returnValues
    if (events[i].event === 'StakeChange') {
      res.push({epoch: data.epoch, staker: staker, action: data.reason, previousStake: data.previousStake, newStake: data.newStake, timestamp: data.timestamp })
    } else if (events[i].event === 'RewardPoolChange') {
      res.push({epoch: data.epoch,  action: events[i].event, previousStake: data.prevRewardPool, newStake: data.rewardPool, timestamp: data.timestamp })
    } else if (events[i].event === 'StakeGettingRewardChange') {
      res.push({epoch: data.epoch,  action: events[i].event, previousStake: data.prevStakeGettingReward, newStake: data.stakeGettingReward, timestamp: data.timestamp })
    } else {
      res.push({epoch: data.epoch, staker: staker, action: events[i].event, previousStake: data.previousStake, newStake: data.newStake, timestamp: data.timestamp })
    }
    // emit RewardPoolChange(epoch, prevRewardPool, rewardPool, now)
    //
    // emit StakeGettingRewardChange(epoch, prevStakeGettingReward, stakeGettingReward, now)

  }

  // emit StakeChange(_id, _stake, _reason)

  return res
}

async function getStakerEvents (_address) {
  let blockNumber = await web3.eth.getBlockNumber()
  // let epoch = Number(await getEpoch()) - 1
  let stakerId = String(await stakeManager.methods.stakerIds(_address).call())
  console.log('stakerId', stakerId)

  let events = await stakeManager.getPastEvents('allEvents', {
    fromBlock: Math.max(0, Number(blockNumber) - 1000),
    // filter: {stakerId: stakerId},
    // fromBlock: 0,
    toBlock: 'latest'
  })
  // console.log(events[3])

  // event Staked(uint256 epoch, uint256 stakerId, uint256 amount, uint256 timestamp)
  // event Unstaked(uint256 epoch, uint256 stakerId, uint256 amount, uint256 timestamp)
  // event Withdrew(uint256 epoch, uint256 stakerId, uint256 amount, uint256 timestamp)

  // console.log(events[2].returnValues)
  let res = []
  let value
  let staker
  let timestamp
  for (let i = 0; i < events.length; i++) {
    if (events[i].returnValues.stakerId !== stakerId) continue
    if (events[i].event === 'WriterAdded') continue
    if (events[i].returnValues.stakerId !== undefined) {
      staker = (await stakeManager.methods.getStaker(events[i].returnValues.stakerId).call())[1]
    }
    let data = events[i].returnValues
    if (events[i].event === 'StakeChange') {
      res.push({epoch: data.epoch, staker: staker, action: data.reason, previousStake: data.previousStake, newStake: data.newStake, timestamp: data.timestamp })
    // } else if (events[i].event === 'RewardPoolChange') {
    //   // res.push({epoch: data.epoch,  action: events[i].event, previousStake: data.prevRewardPool, newStake: data.rewardPool, timestamp: data.timestamp })
    //
    // } else if (events[i].event === 'StakeGettingRewardChange') {
    //   // res.push({epoch: data.epoch,  action: events[i].event, previousStake: data.prevStakeGettingReward, newStake: data.stakeGettingReward, timestamp: data.timestamp })
    //
    // } else {
    //   res.push({epoch: data.epoch, staker: staker, action: events[i].event, previousStake: data.previousStake, newStake: data.newStake, timestamp: data.timestamp })
    }
    // emit RewardPoolChange(epoch, prevRewardPool, rewardPool, now)
    //
    // emit StakeGettingRewardChange(epoch, prevStakeGettingReward, stakeGettingReward, now)

  }

  // emit StakeChange(_id, _stake, _reason)

  return res
}

async function getPoolChanges () {
  let blockNumber = await web3.eth.getBlockNumber()
  // let epoch = Number(await getEpoch()) - 1
  let events = await stakeManager.getPastEvents('allEvents', {
    fromBlock: Math.max(0, Number(blockNumber) - 1000),
    // fromBlock: 0,
    toBlock: 'latest'
  })
  // console.log(events[2].returnValues)
  let res = []
  let value
  let staker
  let timestamp
  for (let i = 0; i < events.length; i++) {
    // staker = (await stakeManager.methods.getStaker(events[i].returnValues.stakerId).call())[1]
    let data = events[i].returnValues
    console.log(events[i].event)
    // event RewardPoolChange(uint256 epoch, uint256 value, uint256 timestamp)
    // event StakeGettingRewardChange(uint256 epoch, uint256 value, uint256 timestamp)
    if (events[i].event === 'RewardPoolChanges' || events[i].event === 'StakeGettingRewardChange') {
      res.push({epoch: data.epoch, value: data.value, action: events[i].event, timestamp: data.timestamp })
    // } else {
    // res.push({epoch: data.epoch, value: data.value, action: events[i].event, timestamp: data.timestamp })
    }
  }

  // emit StakeChange(_id, _stake, _reason)

  return res
}

async function getBlockEvents (provider) {
  let web3Provider = web3Geth
  let providerBlockManager = gethBlockManager
  let providerStakeManager = gethStakeManager
  if (isInfura(provider)) {
    web3Provider = web3
    providerBlockManager = blockManager
    providerStakeManager = stakeManager
  }

  let blockNumber = await web3Provider.eth.getBlockNumber()
  let epoch = Number(await getEpoch(provider)) - 1
  let events = await providerBlockManager.getPastEvents('allEvents', {
    fromBlock: Math.max(0, Number(blockNumber) - 1000),
    toBlock: 'latest'
  })

  // event BlockConfirmed(uint256 epoch,
  //                     uint256 stakerId,
  //                     uint256[] medians,
  //                     uint256[] jobIds,
  //                     uint256 timestamp)

  // emit Proposed(epoch, proposerId, jobIds, medians, lowerCutoffs, higherCutoffs, iteration, biggestStakerId, now)

  // console.log(events[0])
  let res = []
  let value
  let staker
  let timestamp
  for (let i = 0; i < events.length; i++) {
    if (events[i].event === 'WriterAdded' || events[i].event === 'DebugUint256') continue
    // console.log(events[i])
    staker = (await providerStakeManager.methods.getStaker(events[i].returnValues.stakerId).call())[1]
    let data = events[i].returnValues
    if (events[i].event === 'Proposed') {
      res.push({epoch: data.epoch,
        staker: staker,
        action: events[i].event,
        medians: data.medians,
        lowerCutoffs: data.lowerCutoffs,
        higherCutoffs: data.higherCutoffs,
        jobIds: data.jobIds,
        timestamp: data.timestamp,
        iteration: data.iteration,
      biggestStakerId: data.biggestStakerId})
    } else {
      res.push({epoch: data.epoch,
        staker: staker,
        action: events[i].event,
        medians: data.medians,
        lowerCutoffs: data.lowerCutoffs,
        higherCutoffs: data.higherCutoffs,
        jobIds: data.jobIds,
        timestamp: data.timestamp,
        iteration: '',
      biggestStakerId: ''})
    }
  }
  return res
}

async function getJobEvents (provider) {
  let web3Provider = web3Geth
  let manager = gethJobManager
  if (isInfura(provider)) {
    web3Provider = web3
    manager = jobManager
  }

  let blockNumber = await web3Provider.eth.getBlockNumber()
  // let epoch = Number(await getEpoch()) - 1
  let events = await manager.getPastEvents('allEvents', {
    fromBlock: Math.max(0, Number(blockNumber) - 1000),
    toBlock: 'latest'
  })

  // event JobCreated(uint256 id, uint256 epoch, string url, string selector, bool repeat,
  //                         address creator, uint256 credit, uint256 timestamp)
  //
  // event JobReported(uint256 id, uint256 value, uint256 epoch,
  //                     string url, string selector, bool repeat,
  //                     address creator, uint256 credit, bool fulfilled, uint256 timestamp)
  //

  // console.log(events[2].returnValues)
  let res = []
  let value
  let staker
  let timestamp
  for (let i = 0; i < events.length; i++) {
    // staker = (await stakeManager.methods.getStaker(events[i].returnValues.stakerId).call())[1]
    let data = events[i].returnValues
    if (events[i].event === 'WriterAdded') continue
    res.push({epoch: data.epoch, id: data.id, action: events[i].event, url: data.url, selector: data.selector, name: data.name, repeat: data.repeat,
    creator: data.creator, credit: data.credit, timestamp: data.timestamp })
  }
  return res
}

async function commit (votes, secret, account) {
  if (Number(await stateManager.methods.getState().call()) != 0) {
    throw ('Not commit state')
  }
  // let votes = [100, 200, 300, 400, 500, 600, 700, 800, 900]
  // console.log(votes)
  let tree = merkle('keccak256').sync(votes)
  // console.log(tree.root())
  let root = tree.root()

  let stakerId = Number(await stakeManager.methods.stakerIds(account).call())
  let epoch = Number(await stateManager.methods.getEpoch().call())
  if ((await voteManager.methods.commitments(epoch, stakerId).call()) != 0) {
    throw ('Already Committed')
  }
  let commitment = web3.utils.soliditySha3(epoch, root, secret)
  let nonce = await web3.eth.getTransactionCount(account, 'pending')
  console.log(' committing epoch, root, commitment, secret, account, nonce', epoch, root, commitment, secret, account, nonce)
  let tx = await voteManager.methods.commit(epoch, commitment).send({'from': account, 'nonce': nonce})
  return tx
}

async function reveal (votes, secret, commitAccount, account) {
  if (Number(await stateManager.methods.getState().call()) != 1) {
    throw new Error('Not reveal state')
  }
  let stakerId = Number(await stakeManager.methods.stakerIds(account).call())
  let epoch = Number(await stateManager.methods.getEpoch().call())
  console.log('stakerId', stakerId)
  if ((await voteManager.methods.commitments(epoch, stakerId).call()) === 0) {
    throw new Error('Did not commit')
  }
  let revealed = await voteManager.methods.votes(epoch, stakerId, 0).call()
  // console.log('revealed', revealed)
  let voted = revealed.vote
  // console.log('voted', voted)
  if (voted !== undefined) {
    throw new Error('Already Revealed', voted)
  }
  let tree = merkle('keccak256').sync(votes)
  // console.log(tree.root())
  let root = tree.root()
  let proof = []
  for (let i = 0; i < votes.length; i++) {
    proof.push(tree.getProofPath(i, true, true))
  }
  // console.log('epoch', epoch)
  console.log('revealing vote for epoch', Number(await stateManager.methods.getEpoch().call()), 'votes', votes, 'root', root, 'proof', proof, 'secret', secret, 'commitAccount', commitAccount)
  let nonce = await web3.eth.getTransactionCount(account, 'pending')
  let tx = await voteManager.methods.reveal(epoch, root, votes, proof, secret, commitAccount).send({'from': account, 'nonce': nonce})
  // await voteManager.reveal(1, tree.root(), votes, proof,
  //         '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9ddd',
  //         accounts[1], { 'from': accounts[1] })

  return tx
}

async function getBlock (epoch) {
  let block = await blockManager.methods.blocks(epoch).call()
  return (block)
}

async function propose (account) {
  if (Number(await stateManager.methods.getState().call()) != 2) {
    throw ('Not propose state')
  }
  let stakerId = Number(await stakeManager.methods.stakerIds(account).call())
  let epoch = Number(await stateManager.methods.getEpoch().call())
  // console.log('epoch', epoch)
  // let getBlock = await blockManager.methods.proposedBlocks(epoch).call()
  // if (getBlock) {
  //   let proposerId = Number(getBlock.proposerId)
  //   // console.log('proposerId', proposerId)
  //   if (proposerId === stakerId) {
  //     throw new Error('Already proposed')
  //   }
  // }
  // let numStakers = Number(await blockManager.methods.numStakers().call())
  // console.log('numStakers', numStakers)

  let staker = await stakeManager.methods.getStaker(stakerId).call()
  let numStakers = await stakeManager.methods.getNumStakers().call()
  let stake = Number(staker.stake)
  console.log('stake', stake)

  let biggestStake = (await getBiggestStakeAndId(stakeManager))[0]
  console.log('biggestStake', biggestStake)
  let biggestStakerId = (await getBiggestStakeAndId(stakeManager))[1]
  console.log('biggestStakerId', biggestStakerId)
  let blockHashes = await random.methods.blockHashes(numBlocks).call()
  console.log(' biggestStake, stake, stakerId, numStakers, blockHashes', biggestStake, stake, stakerId, numStakers, blockHashes)
  let iteration = await getIteration(random, biggestStake, stake, stakerId, numStakers, blockHashes)
  console.log('iteration1', iteration)
  let nonce = await web3.eth.getTransactionCount(account, 'pending')
  let block = await makeBlock()
  let jobs = await getActiveJobs()
  let jobIds = []
  for (let i = 0; i < jobs.length; i++) {
    jobIds.push(Number(jobs[i].id))
  }
  console.log('epoch, block, jobIds, iteration, biggestStakerId', epoch, block, jobIds, iteration, biggestStakerId)
  let tx = await blockManager.methods.propose(epoch, block, jobIds, iteration, biggestStakerId).send({'from': account, 'nonce': nonce})
  return tx
//
//
// let res = await getIteration()
// let electedProposer = res[0]
// let iteration = res[1]
// let biggestStakerId = res[2]
// // console.log('biggestStakerId', biggestStakerId)
// // console.log('electedProposer, iteration', electedProposer, iteration)
// let block = await makeBlock()
// // console.log('block', block)
// let median = block
// console.log('epoch, median, electedProposer, iteration, biggestStakerId', epoch, median, electedProposer, iteration, biggestStakerId)
// const nonce = await web3.eth.getTransactionCount(account, 'pending')
// let tx = await blockManager.methods.propose(epoch, medians, iteration, biggestStakerId).send({'from': account, 'nonce': nonce})
// return tx
}

// automatically calculate alternative block and submit
async function dispute (account) {
  let epoch = Number(await stateManager.methods.getEpoch().call())
  let res = await getSortedVotes()
  let sortedVotes = res[0]
  let iter = Math.ceil(sortedVotes.length / 1000)
  for (let i = 0; i < iter; i++) {
    console.log(epoch, sortedVotes.slice(i * 1000, (i * 1000) + 1000))
    await blockManager.methods.giveSorted(epoch, sortedVotes.slice(i * 1000, (i * 1000) + 1000)).send({from: account,
    nonce: String(nonce)})
  }
  const nonce = await web3.eth.getTransactionCount(account, 'pending')

  return blockManager.methods.proposeAlt(epoch).send({from: account,
  nonce: String(nonce)})
}

async function getState () {
  return Number(await stateManager.methods.getState().call())
}
async function getEpoch (provider) {
  let manager = isInfura(provider) ? stateManager : gethStateManager
  return Number(await manager.methods.getEpoch().call())
}

async function getStakerId (address) {
  return Number(await stakeManager.methods.stakerIds(address).call())
}

async function getMinStake () {
  return Number((await constants.methods.minStake().call()))
}

async function getStaker (stakerId) {
  return (await stakeManager.methods.stakers(stakerId).call())
}

async function getBiggestStakeAndId (stakeManager) {
  // async function getBiggestStakeAndId (schelling) {
  let biggestStake = 0
  let biggestStakerId = 0
  let numStakers = await stakeManager.methods.numStakers().call()

  for (let i = 1; i <= numStakers; i++) {
    let stake = Number((await stakeManager.methods.stakers(i).call()).stake)
    if (stake > biggestStake) {
      biggestStake = stake
      biggestStakerId = i
    }
  }
  return ([biggestStake, biggestStakerId])
}

async function prng (seed, max, blockHashes) {
  let hashh = await prngHash(seed, blockHashes)
  let sum = web3.utils.toBN(hashh)
  max = web3.utils.toBN(max)
  return (sum.mod(max))
}

// pseudo random hash generator based on block hashes.
async function prngHash (seed, blockHashes) {
  // let sum = blockHashes(numBlocks)
  let sum = await web3.utils.soliditySha3(blockHashes, seed)
  // console.log('prngHash', sum)
  return (sum)
}

async function getIteration (random, biggestStake, stake, stakerId, numStakers, blockHashes) {
  let j = 0
  console.log(blockHashes)
  for (let i = 0; i < 10000000000; i++) {
    // console.log('iteration ', i)

    let isElected = await isElectedProposer(random, i, biggestStake, stake, stakerId, numStakers, blockHashes)
    if (isElected) return (i)
  }
}

async function isElectedProposer (random, iteration, biggestStake, stake, stakerId, numStakers, blockHashes) {
  // rand = 0 -> totalStake-1
  // add +1 since prng returns 0 to max-1 and staker start from 1
  let seed = await web3.utils.soliditySha3(iteration)
  // console.log('seed', seed)
  if ((Number(await prng(seed, numStakers, blockHashes)) + 1) !== stakerId) return (false)
  let seed2 = await web3.utils.soliditySha3(stakerId, iteration)
  let randHash = await prngHash(seed2, blockHashes)
  let rand = Number((await web3.utils.toBN(randHash)).mod(await web3.utils.toBN(2 ** 32)))
  // let biggestStake = stakers[biggestStake].stake
  if (rand * (biggestStake) > stake * (2 ** 32)) return (false)
  return (true)
}

async function makeBlock () {
  let medians = []
  let jobs = await getActiveJobs()
  for (let assetId = 0; assetId < jobs.length; assetId++) {
    let res = await getSortedVotes(assetId)
    let sortedVotes = res[1]
    // console.log('sortedVotes', sortedVotes)
    let epoch = Number(await stateManager.methods.getEpoch().call())

    let totalStakeRevealed = Number(await voteManager.methods.totalStakeRevealed(epoch, assetId).call())
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
    medians.push(median)
  }
  return (medians)
}

async function getSortedVotes (assetId) {
  let epoch = Number(await stateManager.methods.getEpoch().call())

  let numStakers = Number(await stakeManager.methods.numStakers().call())
  let values = []
  let voteWeights = []

  // get all values that stakers voted.
  for (let i = 1; i <= numStakers; i++) {
    let vote = Number((await voteManager.methods.votes(epoch, i, assetId).call()).value)
    // console.log(i, 'voted', vote)
    if (vote === 0) continue // didnt vote
    if (values.indexOf(vote) === -1) values.push(vote)
  }
  values.sort(function (a, b) { return a - b })

  // get weights of those values
  for (let val of values) {
    let weight = Number(await voteManager.methods.voteWeights(epoch, assetId, val).call())
    voteWeights.push([val, weight])
  }
  return [values, voteWeights]
}

async function getBiggestStakerId (stakeManager) {
  let numStakers = Number(await stakeManager.methods.numStakers().call())
  // console.log('numStakers', numStakers)
  let biggestStake = 0
  let biggestStakerId = 0
  for (let i = 1; i <= numStakers; i++) {
    let stake = Number((await stakeManager.methods.stakers(i).call()).stake)
    if (stake > biggestStake) {
      biggestStake = stake
      biggestStakerId = i
    }
  }
  return biggestStakerId
}

async function getStake (stakerId) {
  return String((await stakeManager.methods.stakers(stakerId).call()).stake)
}

async function getProposedBlockMedians (epoch, proposedBlock) {
  return (await blockManager.methods.getProposedBlockMedians(epoch, proposedBlock).call())
}
async function getProposedBlock (epoch, proposedBlock) {
  return (await blockManager.methods.getProposedBlock(epoch, proposedBlock).call())
}
async function getNumProposedBlocks (epoch) {
  return (await blockManager.methods.getNumProposedBlocks(epoch).call())
}

async function getSchBalance (address) {
  return String(await simpleToken.methods.balanceOf(address).call())
}

async function getRazorBalance (address) {
  const etherscanKey = fs.readFileSync('.etherscan').toString().trim()
  const tokenAddress = fs.readFileSync('.tokenAddress').toString().trim()
  const url = `https://api.etherscan.io/api?module=account&action=tokenbalance&contractaddress=${tokenAddress}&address=${address}&tag=latest&apikey=${etherscanKey}`
  try {
    response = await axios.get(url, {timeout: 60000})
    return response.data.result/1000000000000000000
  } catch (e) {
    console.error(e)
  }
}

async function getCirculatingSupply() {
  const addresses = fs.readFileSync('.lockedTokenAddresses').toString().trim().split("\n")
  let lockedValue = 0
  for(let i=0; i<addresses.length; i++) {
    lockedValue = lockedValue + await getRazorBalance(addresses[i])
  }
  return (TOTAL_SUPPLY - lockedValue)
}

async function getEthBalance (address) {
  return String(await web3.eth.getBalance(address))
}

async function sign (input, account) {
  return await web3.eth.sign(input, account)
}
module.exports = {
  login: login,
  sign: sign,
  // transfer: transfer,
  // approve: approve,
  // stake: stake,
  commit: commit,
  reveal: reveal,
  propose: propose,
  dispute: dispute,
  getState: getState,
  getEpoch: getEpoch,
  getStakerId: getStakerId,
  getMinStake: getMinStake,
  getStaker: getStaker,
  getStake: getStake,
  getBiggestStakerId: getBiggestStakerId,
  getBiggestStakeAndId: getBiggestStakeAndId,
  getBlock: getBlock,
  prng: prng,
  prngHash: prngHash,
  getIteration: getIteration,
  isElectedProposer: isElectedProposer,
  makeBlock: makeBlock,
  getProposedBlockMedians: getProposedBlockMedians,
  getProposedBlock: getProposedBlock,
  getNumProposedBlocks: getNumProposedBlocks,
  createJob: createJob,
  getActiveJobs: getActiveJobs,
  getJobValues: getJobValues,
  getJobs: getJobs,
  getResult: getResult,
  getJob: getJob,
  getNumJobs: getNumJobs,
  getVotesLastEpoch: getVotesLastEpoch,
  getVotingEvents: getVotingEvents,
  getStakingEvents: getStakingEvents,
  getJobEvents: getJobEvents,
  getBlockEvents: getBlockEvents,
  getStakers: getStakers,
  getPoolChanges: getPoolChanges,
  getStakerEvents: getStakerEvents,
  getEthBalance: getEthBalance,
  getSchBalance: getSchBalance,
  getCirculatingSupply: getCirculatingSupply
}
