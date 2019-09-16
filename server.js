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
  result = await api.getJobValues(req.params.jobId)
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
  result = await api.getJobs()
  res.json({'message': result})
})

app.get('/stakers/', async function (req, res) {
  result = await api.getStakers()
  res.json({result})
})

app.post('/job/', async function (req, res) {
  result = await api.createJob()
  res.json({'message': result})
})

app.get('/votes/:jobId/', async function (req, res) {
  result = await api.getVotesLastEpoch(req.params.jobId)
  res.json({'message': result})
})
app.get('/voteEvents/:jobId/', async function (req, res) {
  result = await api.getVotingEvents(req.params.jobId)
  res.json({'message': result})
})

app.get('/epoch/', async function (req, res) {
  result = await api.getEpoch()
  res.json({'message': result})
})
// listen for requests
app.listen(3000, () => {
  console.log('Server is listening on port 3000')
})
