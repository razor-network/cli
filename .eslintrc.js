module.exports = {
  'env': {
    'browser': false,
    'node': true,
    'es6': true,
    'amd': true
  },
  'extends': 'eslint:recommended',
  'globals': {
    'Atomics': 'readonly',
    'SharedArrayBuffer': 'readonly'
  },
  'parserOptions': {
    'ecmaVersion': 2018,
    'sourceType': 'module'
  },
  'rules': {
    'no-console': 'off'
  }
}