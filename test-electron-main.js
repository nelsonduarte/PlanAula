// Test using electron/main
const { app } = require('electron/main');
console.log('app type:', typeof app);
console.log('whenReady type:', typeof app.whenReady);
app.whenReady().then(() => {
  console.log('App is READY!');
  app.quit();
});
