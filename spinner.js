var Spinner = require('cli-spinner').Spinner

var spinner = new Spinner('%s')
spinner.setSpinnerString('|/-\\')
spinner.start()
console.log()
