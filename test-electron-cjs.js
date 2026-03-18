const electron = require('electron')
console.log('electron type:', typeof electron)
console.log('electron keys (first 5):', typeof electron === 'object' ? Object.keys(electron).slice(0,5) : 'N/A')
console.log('app:', typeof electron === 'object' ? electron.app : 'N/A')
