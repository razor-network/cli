const Web3 = require("web3");
const { WebsocketProvider } = require("web3-providers");
const { randomHex } = require("web3-utils");

const ji =
  '[{"constant":false,"inputs":[{"name":"name","type":"string"}],"name":"setNick","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"constant":false,"inputs":[{"name":"id","type":"uint256"},{"name":"verdict","type":"bool"}],"name":"resolveWord","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"text","type":"string"}],"name":"addWord","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"}],"name":"names","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getContractBalance","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"","type":"uint256"}],"name":"words","outputs":[{"name":"text","type":"string"},{"name":"bet","type":"uint256"},{"name":"owner","type":"address"},{"name":"resolved","type":"bool"},{"name":"verdict","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getTotalWords","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"ad","type":"address"}],"name":"getNickByAddress","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"id","type":"uint256"}],"name":"getWordById","outputs":[{"name":"","type":"string"},{"name":"","type":"address"},{"name":"","type":"uint256"},{"name":"","type":"bool"},{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"inputs":[{"name":"treasure_","type":"address"}],"payable":false,"stateMutability":"nonpayable","type":"constructor"}]';

const address = "0x9eDEEb93207AB62978b8D24E4ED582A13ff564EA";
const abi = JSON.parse(ji);

const infuraKey = "26056f03e83343f5bbd280bafaa52684";

// Create infuara provider
// const provider = new WebsocketProvider(
//   'wss://rinkeby.infura.io/ws/v3/${infuraKey}'
// );
const provider = new WebsocketProvider(
  'wss://rinkeby.infura.io/ws'
);
const web3 = new Web3(provider);

// Add account from private key

// Setup contract
const contract = new web3.eth.Contract(abi, address, {transactionConfirmationBlocks: 1})

async function run() {
    try {
  await web3.eth.accounts.wallet.create(0, randomHex(32));

  const pk = "0x5EFFF16A73C30E53ED7FE842EBA35B3F11F1EB06D94DB2A836BC3A7479C6F6C9";
  const account = await web3.eth.accounts.privateKeyToAccount(pk);
  await web3.eth.accounts.wallet.add(account);

  const word = "yylolyy";
  const from = await web3.eth.accounts.wallet.accounts[0].address;
  console.log(from)
  const nonce = await web3.eth.getTransactionCount(from, "pending");
  console.log(nonce)
  let gas = await contract.methods
    .addWord(word)
    .estimateGas({ from, gas: "10000000", value: "100000000000000000" });

  gas = Math.round(gas * 1.5);

  console.log(gas)

    const result = await contract.methods.addWord(word).send({
      gas,
      from,
      nonce,
      value: "100000000000000000"
    });

    console.log("success", result);
  } catch (e) {
    console.log("error", e);
  }
}

run();
