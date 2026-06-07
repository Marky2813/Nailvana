const electron = require('electron'); 

electron.contextBridge.exposeInMainWorld('electron', {
  sayHello: () => { 
    console.log('Hello from the preload script!');
  }
})