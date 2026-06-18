import type { IpcRendererEvent } from 'electron';

const electron = require('electron'); 

electron.contextBridge.exposeInMainWorld('electron', {
  sayHello: () => { 
    console.log('Hello from the preload script!');
  },
  fireNotification: (message: string) => {
    electron.ipcRenderer.send('desktop-notification:fire', message);
  },
  desktopNotificationReady: () => {
    electron.ipcRenderer.send('desktop-notification:ready');
  },
  onDesktopNotificationShow: (callback: (message: string) => void) => {
    const listener = (_event: IpcRendererEvent, message: string) => callback(message);

    electron.ipcRenderer.on('desktop-notification:show', listener);

    return () => {
      electron.ipcRenderer.removeListener('desktop-notification:show', listener);
    };
  },
  onDesktopNotificationHide: (callback: () => void) => {
    const listener = () => callback();

    electron.ipcRenderer.on('desktop-notification:hide', listener);

    return () => {
      electron.ipcRenderer.removeListener('desktop-notification:hide', listener);
    };
  },
})
