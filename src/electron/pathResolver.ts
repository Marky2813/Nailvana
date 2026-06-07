import path from 'path';
import { app } from 'electron';
import { isDev } from './utils.js';

export function getPreloadPath() {
  console.log("path resolver is runnning");
  return path.join(app.getAppPath(), 
  isDev() ? '.' : '..', 
  '/dist-electron/preload.cjs'
); 
}