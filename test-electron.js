console.log('sync: process.type =', process.type)
const Module = require('module')

// Check if electron API becomes available asynchronously
setImmediate(() => {
  const e = require('electron')
  console.log('setImmediate: type =', typeof e)
  if (typeof e === 'object') console.log('setImmediate: app =', typeof e.app)
})

setTimeout(() => {
  // Clear cache and retry
  const cacheKeys = Object.keys(Module._cache).filter(k => k.includes('electron'))
  cacheKeys.forEach(k => delete Module._cache[k])
  const e = require('electron')  
  console.log('setTimeout 100ms: type =', typeof e)
  if (typeof e === 'object') console.log('setTimeout: app =', typeof e.app)
  console.log('setTimeout: process.type =', process.type)
  process.exit(0)
}, 100)
