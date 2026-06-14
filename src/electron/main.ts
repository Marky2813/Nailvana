import { app, BrowserWindow, screen, session, Tray } from 'electron'
import path from 'path'
import { isDev } from './utils.js'
import { getPreloadPath } from './pathResolver.js'

const gotLock = app.requestSingleInstanceLock()
let tray: Tray | null = null
let mainWindow: BrowserWindow | null = null
let isQuitting = false

function getTrayIconPath() {
  return isDev()
    ? path.join(app.getAppPath(), 'app.png')
    : path.join(process.resourcesPath, 'app.png')
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function getPopupPosition() {
  if (!tray || !mainWindow || mainWindow.isDestroyed()) {
    return { x: 0, y: 0 }
  }

  const trayBounds = tray.getBounds()
  const windowBounds = mainWindow.getBounds()
  const display = screen.getDisplayNearestPoint({
    x: Math.round(trayBounds.x + trayBounds.width / 2),
    y: Math.round(trayBounds.y + trayBounds.height / 2),
  })
  const workArea = display.workArea
  const centeredX = Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2)
  const aboveTrayY = Math.round(trayBounds.y - windowBounds.height)
  const belowTrayY = Math.round(trayBounds.y + trayBounds.height)
  const preferredY = aboveTrayY >= workArea.y ? aboveTrayY : belowTrayY

  return {
    x: clamp(centeredX, workArea.x, workArea.x + workArea.width - windowBounds.width),
    y: clamp(preferredY, workArea.y, workArea.y + workArea.height - windowBounds.height),
  }
}

if (!gotLock) {
  app.quit()
} else {
  app.on('window-all-closed', () => {})

  app.on('before-quit', () => {
    isQuitting = true
  })

  app.on('ready', () => {
    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
      callback(permission === 'media')
    })
    session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
      return permission === 'media'
    })

    tray = new Tray(getTrayIconPath())

    const popupWindow = new BrowserWindow({
      width: 350,
      height: 490,
      minWidth: 350,
      minHeight: 490,
      maxWidth: 350,
      maxHeight: 490,
      show: false,
      frame: false,
      resizable: false,
      transparent: true,
      backgroundColor: '#00000000',
      webPreferences: {
        preload: getPreloadPath(),
        backgroundThrottling: false,
      },
    })
    mainWindow = popupWindow

    tray.on('click', () => {
      if (!mainWindow || mainWindow.isDestroyed()) {
        return
      }

      if (mainWindow.isVisible()) {
        mainWindow.hide()
        return
      }

      const { x, y } = getPopupPosition()
      mainWindow.setPosition(x, y)
      mainWindow.show()
      mainWindow.focus()
    })

    popupWindow.on('close', (event) => {
      if (isQuitting) {
        return
      }

      event.preventDefault()
      popupWindow.hide()
    })

    popupWindow.on('blur', () => popupWindow.hide())

    if (isDev()) {
      popupWindow.loadURL('http://localhost:5123')
    } else {
      popupWindow.loadFile(path.join(app.getAppPath(), '/dist-react/index.html'))
    }
  })
}
