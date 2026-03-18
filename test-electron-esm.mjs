import { app } from 'electron'
console.log('app type:', typeof app)
app.whenReady().then(() => {
  console.log('App is ready!')
  app.quit()
})
