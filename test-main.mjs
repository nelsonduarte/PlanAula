import { createRequire } from 'module'
const req = createRequire(import.meta.url)
const Module = req('module')

// List all cache keys
const keys = Object.keys(Module._cache)
console.log('total cache entries:', keys.length)
console.log('electron-related keys:', keys.filter(k => k.toLowerCase().includes('electron')))

// Try accessing via getOwnPropertyDescriptor
const desc = Object.getOwnPropertyDescriptor(Module._cache, 'electron')
console.log('electron descriptor:', desc ? { configurable: desc.configurable, enumerable: desc.enumerable, hasValue: 'value' in desc, valueType: typeof desc.value } : 'undefined')
