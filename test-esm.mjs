import electronMain from 'electron/main'
console.log('electron/main default type:', typeof electronMain)
console.log('electron/main keys:', typeof electronMain === 'object' ? Object.keys(electronMain).slice(0,5) : electronMain)
