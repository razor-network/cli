npm i \
move keys_sample.json to keys.json\
add api keys in keys.json

.command('stake <accountId> <amount>')
.alias('s')
.description('Stake some schells')

.command('unstake <accountId>')
.alias('u')
.description('Unstake all schells')

.command('withdraw <accountId>')
.alias('w')
.description('Withdraw all schells. Make sure schells are unstaked and unlocked')

.command('vote <accountId> <api>')
.alias('v')
.description('Start monitoring contract, commit,vote and propose automatically')


.command('transfer <to> <amount> <from>')
.alias('t')
.description('transfer schells')
