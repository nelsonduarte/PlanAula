const e = require('electron')
console.log('type:', typeof e)
if (typeof e === 'object' && e !== null) {
  console.log('keys:', Object.keys(e).slice(0, 5))
  console.log('app type:', typeof e.app)
} else {
  console.log('value:', String(e).substring(0, 80))
}
process.exit(0)
