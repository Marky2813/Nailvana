import { app, BrowserWindow} from 'electron';
import path from 'path';
import { isDev } from './utils.js';
import { getPreloadPath } from './pathResolver.js';
// import { fileURLToPath } from 'url';

//node natively knows which file is running and where but it returns urls when asked becasue this node code is supposed to be run on browesers, other runtime environments. 

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

app.on('ready', () => {
  const mainWindow = new BrowserWindow({
    webPreferences: {
      preload: getPreloadPath(), 
    }
  });
  if(isDev()) {
    mainWindow.loadURL('http://localhost:5123');
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), '/dist-react/index.html'));
  } 
}); 