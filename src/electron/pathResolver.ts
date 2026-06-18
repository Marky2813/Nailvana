import path from 'path'
import { app } from 'electron'

export function getPreloadPath() {
  return path.join(app.getAppPath(), 'dist-electron', 'preload.cjs')
}
