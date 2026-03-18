import { app } from 'electron/main';
console.log('app type:', typeof app);
app.whenReady().then(() => {
  console.log('App is READY!');
  app.quit();
});
