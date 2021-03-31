const Web3 = require('web3')
const config = require('./config.json')
// This can also be the node module debug https://www.npmjs.com/package/debug
const debug = (...messages) => console.log(...messages)

const web3 = new Web3()

/**
 * Refreshes provider instance and attaches even handlers to it
 */
function refreshProvider(web3Obj, providerUrl) {
    let retries = 0

    function retry(event) {
        // Event is always undefined
        if (event) {
            debug('Web3 provider disconnected or errored.')
            retries += 1

            if (retries > 5) {
                debug(`Max retries of 5 exceeding: ${retries} times tried`)
                return setTimeout(refreshProvider, 5000)
            }
        } else {
            debug(`Reconnecting web3 provider ${config.provider}`)
            refreshProvider(web3Obj, providerUrl)
        }

        return null
    }

    const provider = new Web3.providers.WebsocketProvider(providerUrl)

    provider.on('end', () => retry())
    provider.on('error', () => retry())
    provider.on('connect', () => console.log('Connected'))

    web3Obj.setProvider(provider)

    debug('New Web3 provider initiated')

    return provider
}


refreshProvider(web3, config.provider)

module.exports = web3