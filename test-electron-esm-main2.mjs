import electron from 'electron/main';
console.log('electron type:', typeof electron);
console.log('electron keys:', Object.keys(electron).slice(0, 10));
const { app } = electron;
console.log('app:', typeof app);
app.whenReady().then(() => {
  console.log('App is READY!');
  app.quit();
});
