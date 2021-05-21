let Web3 = require("web3");
let { randomHex } = require("web3-utils");
let fs = require("fs");
let sleep = require("util").promisify(setTimeout);
const BN = require("bn.js");
var config = require("./config.json");

let infuraKey = config.infuraKey;
let provider = config.httpProvider;
let networkid = config.networkid;
let numBlocks = config.numBlocks;
// const infuraKey = fs.readFileSync('.infura').toString().trim()
// let provider = 'ws://localhost:8545'
// let provider = 'ws://localhost:8546'
// let provider = 'wss://rinkeby.infura.io/ws/v3/' + infuraKey
// let provider = 'ws://35.188.201.171:8546'
// let networkid = '420' // testnet
// let networkid = '4' // rinkeby
let web3 = new Web3(provider, null, {});

let merkle = require("@razor-network/merkle");
let stakeManagerAbi = require("@razor-network/contracts/abi/StakeManager.json");
let stateManagerAbi = require("@razor-network/contracts/abi/StateManager.json");
let blockManagerAbi = require("@razor-network/contracts/abi/BlockManager.json");
let voteManagerAbi = require("@razor-network/contracts/abi/VoteManager.json");
let jobManagerAbi = require("@razor-network/contracts/abi/JobManager.json");
let constantsAbi = require("@razor-network/contracts/abi/Constants.json");
let randomAbi = require("@razor-network/contracts/abi/Random.json");
let addresses = require("./addresses.json");

let simpleTokenAbi = require("@razor-network/contracts/abi/SchellingCoin.json");
// let simpleTokenAbi = simpleTokenBuild["abi"];

const options = {
  transactionConfirmationBlocks: 1,
  gas: 1000000,
  gasPrice: 200000000000,
};
// let numBlocks = 10
let stakeManager = new web3.eth.Contract(
  stakeManagerAbi,
  addresses["StakeManager"],
  options
);
let stateManager = new web3.eth.Contract(
  stateManagerAbi,
  addresses["StateManager"],
  options
);
let blockManager = new web3.eth.Contract(
  blockManagerAbi,
  addresses["BlockManager"],
  options
);
let voteManager = new web3.eth.Contract(
  voteManagerAbi,
  addresses["VoteManager"],
  options
);
let jobManager = new web3.eth.Contract(
  jobManagerAbi,
  addresses["JobManager"],
  options
);
let constants = new web3.eth.Contract(
  constantsAbi,
  addresses["Constants"],
  options
);
let random = new web3.eth.Contract(randomAbi, addresses["Random"], options);

let simpleToken = new web3.eth.Contract(
  simpleTokenAbi,
  addresses["SchellingCoin"],
  options
);

async function login(address, password) {
  await web3.eth.accounts.wallet.create(0, randomHex(32));
  let rawdata = await fs.readFileSync("keys/" + address + ".json");
  let keystoreArray = JSON.parse(rawdata);
  let wall = await web3.eth.accounts.wallet.decrypt([keystoreArray], password);
  let pk = wall[0].privateKey;
  let account = await web3.eth.accounts.privateKeyToAccount(pk);
  await web3.eth.accounts.wallet.add(account);
  let from = await wall[0].address;
  console.log(from, " unlocked");
  return from;
}

async function transfer(to, amount, from) {
  const nonce = await web3.eth.getTransactionCount(from, "pending");
  // console.log(nonce)
  // let gas = await simpleToken.methods
  //   .approve(to, amount)
  //   .estimateGas({ from, gas: '6000000'})
  // gas = Math.round(gas * 1.5)

  // console.log(gas)
  let amountBN = String(new BN(amount).mul(new BN(10).pow(new BN("18"))));
  // amountBN = String(amountBN)
  let res = await simpleToken.methods
    .transfer(to, amountBN)
    .send({ from: from, nonce: nonce });
  console.log(res);
}

async function approve(to, amount, from) {
  const nonce = await web3.eth.getTransactionCount(from, "pending");
  console.log("web3.eth.version", web3.version);
  // console.log(nonce)
  // let gas = await simpleToken.methods
  //   .approve(to, amount)
  //   .estimateGas({ from, gas: '6000000'})
  // gas = Math.round(gas * 1.5)

  // console.log(gas)
  console.log("checking allowance... from, to", from, to);
  let allowance = await simpleToken.methods.allowance(from, to).call();
  console.log("allowance", Number(allowance));
  if (Number(allowance) >= amount) {
    console.log("sufficient allowance. No need to increase");
    return;
  } else {
    console.log("Sending approve transaction...");
    return simpleToken.methods.approve(to, amount).send({
      from: from,
      nonce: nonce,
    });
  }
}

async function stake(amount, account) {
  let epoch;
  let state;
  console.log("account", account);
  let balance =
    Number(await simpleToken.methods.balanceOf(account).call()) / 1e18;
  console.log("schell balance", balance, "schells");
  if (balance < amount) throw new Error("Not enough schells to stake");
  let ethBalance = Number(await web3.eth.getBalance(account)) / 1e18;
  console.log("ether balance", ethBalance, "eth");

  if (ethBalance < 0.01)
    throw new Error(
      "Please fund this account with more ether to pay for tx fees"
    );

  let amountBN = new BN(amount);
  amountBN = amountBN.mul(new BN(10).pow(new BN("18")));
  amountBN = String(amountBN);
  console.log("amountBN", amountBN);
  let tx = await approve(stakeManager.options.address, amountBN, account);
  if (tx) {
    console.log(tx.events);
    if (tx.events.Approval.event !== "Approval")
      throw new Error("Approval failed");
  }
  while (true) {
    epoch = Number(await stateManager.methods.getEpoch().call());
    // state = Number(await getDelayedState())
    state = await getDelayedState();
    console.log("epoch", epoch);
    console.log("state", state);
    if (state !== 0) {
      console.log(
        "Can only stake during state 0 (commit). Retrying in 1 second..."
      );
      await sleep(1000);
    } else break;
  }
  console.log("Sending stake transaction...");
  let nonce = await web3.eth.getTransactionCount(account, "pending");

  let tx2 = await stakeManager.methods.stake(epoch, amountBN).send({
    from: account,
    nonce: String(nonce),
  });
  console.log(tx2.events);
  return tx2.events.Staked.event === "Staked";
}

async function unstake(account) {
  let epoch = Number(await stateManager.methods.getEpoch().call());
  console.log("epoch", epoch);
  console.log("account", account);
  let balance = Number(await simpleToken.methods.balanceOf(account).call());
  console.log("balance", balance);
  if (balance === 0) throw new Error("balance is 0");
  let nonce = await web3.eth.getTransactionCount(account, "pending");

  let tx = await stakeManager.methods
    .unstake(epoch)
    .send({ from: account, nonce: String(nonce) });
  console.log(tx.events);
  return tx.events.Unstaked.event === "Unstaked";
}

async function withdraw(account) {
  let epoch = Number(await stateManager.methods.getEpoch().call());
  console.log("epoch", epoch);
  console.log("account", account);
  let balance = Number(await simpleToken.methods.balanceOf(account).call());
  console.log("balance", balance);
  if (balance === 0) throw new Error("balance is 0");
  let nonce = await web3.eth.getTransactionCount(account, "pending");

  let tx = await stakeManager.methods
    .withdraw(epoch)
    .send({ from: account, nonce: String(nonce) });
  console.log(tx.events);
  return tx.events.Unstaked.event === "Unstaked";
}

async function createJob(url, selector, name, repeat, eth, account) {
  let nonce = await web3.eth.getTransactionCount(account, "pending");

  return jobManager.methods
    .createJob(url, selector, name, repeat)
    .send({ from: account, nonce: String(nonce), value: eth });
}

async function getActiveJobs() {
  let numJobs = Number(await jobManager.methods.numJobs().call());
  let job;
  let jobs = [];
  let epoch = Number(await stateManager.methods.getEpoch().call());
  for (let i = 1; i <= numJobs; i++) {
    job = await jobManager.methods.jobs(i).call();
    if (!job.fulfilled && Number(job.epoch) < epoch) {
      jobs.push(job);
    }
  }
  return jobs;
}

async function getJobs() {
  let numJobs = Number(await jobManager.methods.numJobs().call());
  let job;
  let jobs = [];
  // let epoch = Number(await stateManager.methods.getEpoch().call())
  for (let i = 1; i <= numJobs; i++) {
    job = await jobManager.methods.jobs(i).call();
    jobs.push(job);
  }
  return jobs;
}

async function getJobValues(jobId) {
  let blockNumber = await web3.eth.getBlockNumber();

  let fulfills = await jobManager.getPastEvents("JobReported", {
    fromBlock: Math.min(0, Number(blockNumber) - 1000),
    toBlock: "latest",
  });
  // console.log('fulfills', fulfills)
  let values = [];
  for (let i = 0; i < fulfills.length; i++) {
    if (Number(fulfills[i].returnValues.id) === Number(jobId))
      values.push(fulfills[i].returnValues);
  }
  return values;
}

async function commit(votes, secret, account) {
  if ((await getDelayedState()) != 0) {
    throw "Not commit state";
  }
  // let votes = [100, 200, 300, 400, 500, 600, 700, 800, 900]
  console.log(votes);
  let tree = merkle("keccak256").sync(votes);
  // console.log(tree.root())
  let root = tree.root();

  let stakerId = Number(await stakeManager.methods.stakerIds(account).call());
  let epoch = Number(await stateManager.methods.getEpoch().call());
  if ((await voteManager.methods.commitments(epoch, stakerId).call()) != 0) {
    throw "Already Committed";
  }
  let commitment = web3.utils.soliditySha3(epoch, root, secret);
  let nonce = await web3.eth.getTransactionCount(account, "pending");
  console.log(
    " committing epoch, root, commitment, secret, account, nonce",
    epoch,
    root,
    commitment,
    secret,
    account,
    nonce
  );
  let tx = await voteManager.methods
    .commit(epoch, commitment)
    .send({ from: account, nonce: nonce });
  return tx;
}

async function reveal(votes, secret, commitAccount, account) {
  if (Number(await getDelayedState()) != 1) {
    throw new Error("Not reveal state");
  }
  let stakerId = Number(await stakeManager.methods.stakerIds(account).call());
  let epoch = Number(await stateManager.methods.getEpoch().call());
  console.log("stakerId", stakerId);
  if ((await voteManager.methods.commitments(epoch, stakerId).call()) === 0) {
    throw new Error("Did not commit");
  }
  let revealed = await voteManager.methods.votes(epoch, stakerId, 0).call();
  // console.log('revealed', revealed)
  let voted = revealed.vote;
  // console.log('voted', voted)
  if (voted !== undefined) {
    throw new Error("Already Revealed", voted);
  }
  let tree = merkle("keccak256").sync(votes);
  // console.log(tree.root())
  let root = tree.root();
  let proof = [];
  for (let i = 0; i < votes.length; i++) {
    proof.push(tree.getProofPath(i, true, true));
  }
  // console.log('epoch', epoch)
  console.log(
    "revealing vote for epoch",
    Number(await stateManager.methods.getEpoch().call()),
    "votes",
    votes,
    "root",
    root,
    "proof",
    proof,
    "secret",
    secret,
    "commitAccount",
    commitAccount
  );
  let nonce = await web3.eth.getTransactionCount(account, "pending");
  let tx = await voteManager.methods
    .reveal(epoch, root, votes, proof, secret, commitAccount)
    .send({ from: account, nonce: nonce });
  // await voteManager.reveal(1, tree.root(), votes, proof,
  //         '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9ddd',
  //         accounts[1], { 'from': accounts[1] })

  return tx;
}

async function getBlock(epoch) {
  let block = await blockManager.methods.blocks(epoch).call();
  return block;
}

async function propose(account) {
  if (Number(await getDelayedState()) != 2) {
    throw "Not propose state";
  }
  let stakerId = Number(await stakeManager.methods.stakerIds(account).call());
  let epoch = Number(await stateManager.methods.getEpoch().call());
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

  let staker = await stakeManager.methods.getStaker(stakerId).call();
  let numStakers = await stakeManager.methods.getNumStakers().call();
  let stake = Number(staker.stake);
  console.log("stake", stake);

  let biggestStake = (await getBiggestStakeAndId(stakeManager))[0];
  console.log("biggestStake", biggestStake);
  let biggestStakerId = (await getBiggestStakeAndId(stakeManager))[1];
  console.log("biggestStakerId", biggestStakerId);
  let blockHashes = await random.methods.blockHashes(numBlocks).call();
  console.log(
    " biggestStake, stake, stakerId, numStakers, blockHashes",
    biggestStake,
    stake,
    stakerId,
    numStakers,
    blockHashes
  );
  let iteration = await getIteration(
    random,
    biggestStake,
    stake,
    stakerId,
    numStakers,
    blockHashes
  );
  console.log("iteration1", iteration);
  let nonce = await web3.eth.getTransactionCount(account, "pending");
  let block = await makeBlock();
  console.log("block", block);
  let jobs = await getActiveJobs();
  let jobIds = [];
  for (let i = 0; i < jobs.length; i++) {
    jobIds.push(Number(jobs[i].id));
  }
  console.log(
    "epoch, block, jobIds, iteration, biggestStakerId",
    epoch,
    block,
    jobIds,
    iteration,
    biggestStakerId
  );
  let tx = await blockManager.methods
    .propose(
      epoch,
      jobIds,
      block[0],
      block[1],
      block[2],
      iteration,
      biggestStakerId
    )
    .send({ from: account, nonce: nonce });
  return tx;
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
async function dispute(account) {
  let epoch = Number(await stateManager.methods.getEpoch().call());
  let res = await getSortedVotes();
  let sortedVotes = res[0];
  let iter = Math.ceil(sortedVotes.length / 1000);
  for (let i = 0; i < iter; i++) {
    console.log(epoch, sortedVotes.slice(i * 1000, i * 1000 + 1000));
    await blockManager.methods
      .giveSorted(epoch, sortedVotes.slice(i * 1000, i * 1000 + 1000))
      .send({ from: account, nonce: String(nonce) });
  }
  const nonce = await web3.eth.getTransactionCount(account, "pending");

  return blockManager.methods
    .proposeAlt(epoch)
    .send({ from: account, nonce: String(nonce) });
}

async function getState() {
  return Number(await getDelayedState());
}

// report state delayed to avoid tx reverts
async function getDelayedState() {
  let blockNumber = await web3.eth.getBlockNumber();
  // its too late to make the tx
  if (blockNumber % 10 > 4 || blockNumber % 10 < 1) return -1;
  let state = Math.floor(blockNumber / 10);

  state = state % 4;

  console.log("delayed state", state);
  return state;
}
async function getEpoch() {
  return Number(await stateManager.methods.getEpoch().call());
}

async function getStakerId(address) {
  return Number(await stakeManager.methods.stakerIds(address).call());
}

async function getMinStake() {
  return Number(await constants.methods.minStake().call());
}

async function getStaker(stakerId) {
  return await stakeManager.methods.stakers(stakerId).call();
}

async function getBiggestStakeAndId(stakeManager) {
  // async function getBiggestStakeAndId (schelling) {
  let biggestStake = 0;
  let biggestStakerId = 0;
  let numStakers = await stakeManager.methods.numStakers().call();

  for (let i = 1; i <= numStakers; i++) {
    let stake = Number((await stakeManager.methods.stakers(i).call()).stake);
    if (stake > biggestStake) {
      biggestStake = stake;
      biggestStakerId = i;
    }
  }
  return [biggestStake, biggestStakerId];
}

async function prng(seed, max, blockHashes) {
  let hashh = await prngHash(seed, blockHashes);
  let sum = web3.utils.toBN(hashh);
  max = web3.utils.toBN(max);
  return sum.mod(max);
}

// pseudo random hash generator based on block hashes.
async function prngHash(seed, blockHashes) {
  // let sum = blockHashes(numBlocks)
  let sum = await web3.utils.soliditySha3(blockHashes, seed);
  // console.log('prngHash', sum)
  return sum;
}

async function getIteration(
  random,
  biggestStake,
  stake,
  stakerId,
  numStakers,
  blockHashes
) {
  let j = 0;
  console.log(blockHashes);
  for (let i = 0; i < 10000000000; i++) {
    // console.log('iteration ', i)

    let isElected = await isElectedProposer(
      random,
      i,
      biggestStake,
      stake,
      stakerId,
      numStakers,
      blockHashes
    );
    if (isElected) return i;
  }
}

async function isElectedProposer(
  random,
  iteration,
  biggestStake,
  stake,
  stakerId,
  numStakers,
  blockHashes
) {
  // rand = 0 -> totalStake-1
  // add +1 since prng returns 0 to max-1 and staker start from 1
  let seed = await web3.utils.soliditySha3(iteration);
  // console.log('seed', seed)
  if (Number(await prng(seed, numStakers, blockHashes)) + 1 !== stakerId)
    return false;
  let seed2 = await web3.utils.soliditySha3(stakerId, iteration);
  let randHash = await prngHash(seed2, blockHashes);
  let rand = Number(
    (await web3.utils.toBN(randHash)).mod(await web3.utils.toBN(2 ** 32))
  );
  // let biggestStake = stakers[biggestStake].stake
  if (rand * biggestStake > stake * 2 ** 32) return false;
  return true;
}

async function weightedMedianAndCuttofs(values, weights) {
  let medianWeight = Math.floor(weights.reduce((a, b) => a + b, 0) / 2);
  let lowerCutoffWeight = Math.floor(weights.reduce((a, b) => a + b, 0) / 4);
  let higherCutoffWeight = Math.floor(
    (weights.reduce((a, b) => a + b, 0) * 3) / 4
  );
  let median = 0;
  let lowerCutoff = 0;
  let higherCutoff = 0;
  console.log("medianWeight", medianWeight);
  console.log("lowerCutoffWeight", lowerCutoffWeight);
  console.log("higherCutoffWeight", higherCutoffWeight);
  let weight = 0;
  for (i = 0; i < values.length; i++) {
    weight += weights[i];
    // console.log('weight', weight)
    if (weight >= medianWeight && median === 0) {
      median = values[i];
    }
    if (weight >= lowerCutoffWeight && lowerCutoff === 0) {
      lowerCutoff = values[i];
    }
    if (weight >= higherCutoffWeight && higherCutoff === 0) {
      higherCutoff = values[i];
    }
  }
  return [median, lowerCutoff, higherCutoff];
}

async function makeBlock() {
  let medians = [];
  let lowerCutoffs = [];
  let higherCutoffs = [];
  let jobs = await getActiveJobs();
  for (let assetId = 0; assetId < jobs.length; assetId++) {
    let res = await getSortedVotes(assetId);
    let sortedVotes = res[0];
    let weights = res[1];
    console.log("sortedVotes", sortedVotes);
    console.log("weights", weights);
    // let epoch = Number(await stateManager.methods.getEpoch().call())

    // let totalStakeRevealed = Number(await voteManager.methods.totalStakeRevealed(epoch, assetId).call())
    // console.log('totalStakeRevealed', totalStakeRevealed)
    // let medianWeight = Math.floor(totalStakeRevealed / 2)
    // console.log('medianWeight', medianWeight)

    let result = await weightedMedianAndCuttofs(sortedVotes, weights);
    let median = result[0];
    let lowerCutoff = result[1];
    let higherCutoff = result[2];
    console.log("median", median);
    console.log("lowerCutoff", lowerCutoff);
    console.log("higherCutoff", higherCutoff);
    //     let deviations = sortedVotes.map(function(value, index) {
    //         return [Math.abs(value - median),weights[index]]
    //     })
    //
    //     console.log('deviations', deviations)
    //
    //
    //     let mad = await weightedMedian(deviations, weights)
    //     console.log('mad', mad)
    //
    //
    //     let penalized = []
    //     for(let i = 0; i < deviations.length; i++) {
    //         if(deviations[i] > mad) penalized.push(sortedVotes[i])
    //     }
    //     console.log('penalized', penalized)
    //     // penalized.sort(function (a, b) { return a[1] - b[1] })
    //
    //     // console.log('penalizedSorted', penalized)
    // if(median===undefined) median = 0
    // let lowerCutoff    = median
    // let higherCutoff = median
    // if(penalized.length>0) {
    //      lowerCutoff = Math.min(...penalized)
    //     console.log('lowerCutoff', lowerCutoff)
    //
    //      higherCutoff = Math.max(...penalized)
    //     console.log('higherCutoff', higherCutoff)
    // }
    //

    medians.push(median);
    lowerCutoffs.push(lowerCutoff);
    higherCutoffs.push(higherCutoff);
  }
  return [medians, lowerCutoffs, higherCutoffs];
}

//
// async function makeBlock () {
//       let medians = []
//       let lowerCutoffs = []
//       let higherCutoffs = []
//       let jobs = await getActiveJobs()
//       for (let assetId = 0; assetId < jobs.length; assetId++) {
//
//   let res = await getSortedVotes(assetId)
//   let sortedVotes = res[1]
//   console.log('sortedVotes', sortedVotes)
//   let epoch = Number(await schelling.methods.getEpoch().call())
//
//   let totalStakeRevealed = Number(await schelling.methods.totalStakeRevealed(epoch).call())
//   console.log('totalStakeRevealed', totalStakeRevealed)
//   let medianWeight = Math.floor(totalStakeRevealed / 2)
//   console.log('medianWeight', medianWeight)
//   let twoFiveWeight = Math.floor(totalStakeRevealed / 4)
//   console.log('twoFiveWeight', twoFiveWeight)
//   let sevenFiveWeight = Math.floor(totalStakeRevealed * 3 / 4)
//   console.log('sevenFiveWeight', sevenFiveWeight)
//
//   let i = 0
//   let twoFive = 0
//   let sevenFive = 0
//   let median = 0
//   let weight = 0
//   let stakeGettingReward = 0
//   let stakeGettingPenalty = 0
//   for (i = 0; i < sortedVotes.length; i++) {
//     weight += sortedVotes[i][1]
//     console.log('weight', weight)
//     if (weight > twoFiveWeight && twoFive === 0) twoFive = sortedVotes[i][0]
//     if (weight > medianWeight && median === 0) median = sortedVotes[i][0]
//     if (weight >= sevenFiveWeight && sevenFive === 0) sevenFive = sortedVotes[i][0]
//   }
//   return ([median, twoFive, sevenFive])
// }

async function getSortedVotes(assetId) {
  let epoch = Number(await stateManager.methods.getEpoch().call());

  let numStakers = Number(await stakeManager.methods.numStakers().call());
  let values = [];
  let voteWeights = [];

  // get all values that stakers voted.
  for (let i = 1; i <= numStakers; i++) {
    let vote = Number(
      (await voteManager.methods.votes(epoch, i, assetId).call()).value
    );
    // console.log(i, 'voted', vote)
    if (vote === 0) continue; // didnt vote
    if (values.indexOf(vote) === -1) values.push(vote);
  }
  values.sort(function (a, b) {
    return a - b;
  });

  // get weights of those values
  for (let val of values) {
    let weight = Number(
      await voteManager.methods.voteWeights(epoch, assetId, val).call()
    );
    voteWeights.push(weight);
  }
  return [values, voteWeights];
}

async function getBiggestStakerId(stakeManager) {
  let numStakers = Number(await stakeManager.methods.numStakers().call());
  // console.log('numStakers', numStakers)
  let biggestStake = 0;
  let biggestStakerId = 0;
  for (let i = 1; i <= numStakers; i++) {
    let stake = Number((await stakeManager.methods.stakers(i).call()).stake);
    if (stake > biggestStake) {
      biggestStake = stake;
      biggestStakerId = i;
    }
  }
  return biggestStakerId;
}

async function getStake(stakerId) {
  return Number((await stakeManager.methods.stakers(stakerId).call()).stake);
}

async function getProposedBlockMedians(epoch, proposedBlock) {
  return await blockManager.methods
    .getProposedBlockMedians(epoch, proposedBlock)
    .call();
}
async function getProposedBlockMedians(epoch, proposedBlock) {
  return await blockManager.methods
    .getProposedBlockMedians(epoch, proposedBlock)
    .call();
}
async function getProposedBlockMedians(epoch, proposedBlock) {
  return await blockManager.methods
    .getProposedBlockMedians(epoch, proposedBlock)
    .call();
}
async function getProposedBlock(epoch, proposedBlock) {
  return await blockManager.methods
    .getProposedBlock(epoch, proposedBlock)
    .call();
}
async function getNumProposedBlocks(epoch) {
  return await blockManager.methods.getNumProposedBlocks(epoch).call();
}

async function sign(input, account) {
  return await web3.eth.sign(input, account);
}
module.exports = {
  login: login,
  sign: sign,
  transfer: transfer,
  approve: approve,
  stake: stake,
  commit: commit,
  reveal: reveal,
  propose: propose,
  dispute: dispute,
  getState: getState,
  getDelayedState: getDelayedState,
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
};
