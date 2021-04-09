const express = require('express')
var cors = require('cors')

const bodyParser = require('body-parser')
const api = require('./httpApi')

// create express app
const app = express()

app.use(cors())

// parse requests of content-type - application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }))

// parse requests of content-type - application/json
app.use(bodyParser.json())

// define a simple route
app.get('/', (req, res) => {
  res.json({'message': 'Welcome'})
})

app.get('/job/:jobId', async function (req, res) {
  const { provider } = req.query
  result = await api.getJobValues(req.params.jobId, provider)
  // console.log('wut', result)
  res2 = {}
  for (let i = 0; i < result.length; i++) {
    res2[i] = {
      'value': result[i].value,
      'timestamp': result[i].timestamp
    }
  }
  // result = JSON.stringify(result)
  // console.log(result)

  res.json(res2)
})

app.get('/activeJobs/', async function (req, res) {
  result = await api.getActiveJobs()
  res.json({'message': result})
})
app.get('/jobs/', async function (req, res) {
  const { provider } = req.query
  result = await api.getJobs(provider)
  res.json({'message': result})
})

app.get('/stakers/', async function (req, res) {
  result = await api.getStakers()
  res.json({result})
})

app.get('/stakerEvents/:address', async function (req, res) {
  result = await api.getStakerEvents(req.params.address)
  res.json({result})
})

app.post('/job/', async function (req, res) {
  result = await api.createJob()
  res.json({'message': result})
})

app.get('/votes/:jobId/', async function (req, res) {
  const { provider } = req.query
  result = await api.getVotesLastEpoch(req.params.jobId, provider)
  res.json({'message': result})
})

app.get('/voteEvents/:jobId/', async function (req, res) {
  const { provider } = req.query
  result = await api.getVotingEvents(req.params.jobId, provider)
  // console.log(result)
  res.json({'message': result})
})

app.get('/voteEvents/', async function (req, res) {
  const { provider } = req.query
  result = await api.getVotingEvents(null, provider)
  // console.log(result)
  res.json({'message': result})
})

app.get('/jobEvents/', async function (req, res) {
  const { provider } = req.query
  result = await api.getJobEvents(provider)
  // console.log(result)
  res.json({'message': result})
})
app.get('/blockEvents/', async function (req, res) {
  const { provider } = req.query
  result = await api.getBlockEvents(provider)
  // console.log(result)
  res.json({'message': result})
})

app.get('/stakingEvents/', async function (req, res) {
  const { provider } = req.query
  result = await api.getStakingEvents(provider)
  // console.log(result)
  res.json({'message': result})
})
// app.get('/events/', async function (req, res) {
//   result1 = await api.getStakingEvents()
//   result = await api.getStakingEvents()
//   console.log(result)
//   res.json({'message': result})
// })

app.get('/epoch/', async function (req, res) {
  const { provider } = req.query
  result  = await api.getEpoch(provider)
  res.json({'message': result})
})
app.get('/poolChanges/', async function (req, res) {
  result = await api.getPoolChanges()
  res.json({'message': result})
})
app.get('/random/', async function (req, res) {
  // result = await api.getEpoch()
  result = Math.random() * 1000000
  res.json({'message': result})
})

app.get('/getSchBalance/:address', async function (req, res) {
  // result = await api.getEpoch()
  result = await api.getSchBalance(req.params.address)
  res.json({'message': result})
})

app.get('/razor/circulating', async function (req, res) {
  // result = await api.getEpoch()
  result = await api.getCirculatingSupply()
  res.json(result)
})

app.get('/getStake/:address', async function (req, res) {
  // result = await api.getEpoch()
  let id = Number(await api.getStakerId(req.params.address))
  result = await api.getStake(id)
  res.json({'message': result})
})

app.get('/getEthBalance/:address', async function (req, res) {
  // result = await api.getEpoch()
  result = await api.getEthBalance(req.params.address)
  res.json({'message': result})
})
// listen for requests
app.listen(3000, () => {
  console.log('Server is listening on port 3000')
})
