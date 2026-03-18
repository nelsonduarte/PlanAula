const { app } = require('electron')
console.log('app type:', typeof app)
if (app && typeof app.whenReady === 'function') {
  app.whenReady().then(() => {
    console.log('App is ready!')
    app.quit()
  })
} else {
  console.log('app is undefined or not working')
  process.exit(1)
}
