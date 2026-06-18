import { app, BrowserWindow, ipcMain, screen, session, Tray } from 'electron'
import path from 'path'
import { isDev } from './utils.js'
import { getPreloadPath } from './pathResolver.js'

const gotLock = app.requestSingleInstanceLock()
let tray: Tray | null = null
let mainWindow: BrowserWindow | null = null
let notificationWindow: BrowserWindow | null = null
let notificationHideTimer: NodeJS.Timeout | undefined
let notificationWindowHideTimer: NodeJS.Timeout | undefined
let isNotificationRendererReady = false
let pendingNotificationMessage: string | null = null
let isQuitting = false
const NOTIFICATION_WIDTH = 400
const NOTIFICATION_HEIGHT = 86
const TRAY_GUID = '8f3c2a1b-6d4e-4f5a-9b2c-1d0e8f7a6b5c'

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

function getNotificationPosition() {
  const displayBounds = screen.getPrimaryDisplay().bounds

  return {
    x: Math.round(displayBounds.x + displayBounds.width / 2 - NOTIFICATION_WIDTH / 2),
    y: displayBounds.y + 25,
  }
}

function loadRenderer(window: BrowserWindow, hash?: string) {
  if (isDev()) {
    window.loadURL(`http://localhost:5123${hash ? `/#${hash}` : ''}`)
    return
  }

  window.loadFile(path.join(app.getAppPath(), '/dist-react/index.html'), { hash })
}

function createNotificationWindow() {
  const { x, y } = getNotificationPosition()
  const window = new BrowserWindow({
    width: NOTIFICATION_WIDTH,
    height: NOTIFICATION_HEIGHT,
    x,
    y,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    resizable: false,
    movable: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: getPreloadPath(),
      backgroundThrottling: false,
    },
  })

  window.setIgnoreMouseEvents(true)

  if (process.platform === 'darwin') {
    window.setAlwaysOnTop(true, 'screen-saver')
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  }

  window.on('closed', () => {
    notificationWindow = null
    isNotificationRendererReady = false
  })

  loadRenderer(window, 'desktop-notification')
  return window
}

function sendDesktopNotificationShow(window: BrowserWindow, message: string) {
  if (!isNotificationRendererReady) {
    pendingNotificationMessage = message
    return
  }

  pendingNotificationMessage = null
  window.webContents.send('desktop-notification:show', message)
}

function showDesktopNotification(message: string) {
  if (!notificationWindow || notificationWindow.isDestroyed()) {
    notificationWindow = createNotificationWindow()
  }

  const window = notificationWindow
  const { x, y } = getNotificationPosition()

  if (notificationHideTimer !== undefined) {
    clearTimeout(notificationHideTimer)
  }

  if (notificationWindowHideTimer !== undefined) {
    clearTimeout(notificationWindowHideTimer)
  }

  window.setPosition(x, y)

  if (process.platform === 'darwin') {
    window.setAlwaysOnTop(true, 'screen-saver')
  } else {
    window.setAlwaysOnTop(true)
  }

  window.showInactive()
  sendDesktopNotificationShow(window, message)

  notificationHideTimer = setTimeout(() => {
    if (!notificationWindow || notificationWindow.isDestroyed()) {
      return
    }

    notificationWindow.webContents.send('desktop-notification:hide')
    notificationWindowHideTimer = setTimeout(() => {
      if (!notificationWindow || notificationWindow.isDestroyed()) {
        return
      }

      notificationWindow.hide()
    }, 260)
  }, 2500)
}
if (app.isPackaged) {
  app.setLoginItemSettings({ openAtLogin: true })
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

    tray =
      process.platform === 'win32'
        ? new Tray(getTrayIconPath(), TRAY_GUID)
        : new Tray(getTrayIconPath())

    const popupWindow = new BrowserWindow({
      width: 350,
      height: 492,
      minWidth: 350,
      minHeight: 492,
      maxWidth: 350,
      maxHeight: 492,
      show: true,
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
    notificationWindow = createNotificationWindow()

    ipcMain.on('desktop-notification:fire', (_event, message: string) => {
      showDesktopNotification(message)
    })
    ipcMain.on('desktop-notification:ready', () => {
      isNotificationRendererReady = true

      if (!notificationWindow || notificationWindow.isDestroyed() || pendingNotificationMessage === null) {
        return
      }

      notificationWindow.webContents.send('desktop-notification:show', pendingNotificationMessage)
      pendingNotificationMessage = null
    })

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

    loadRenderer(popupWindow)
  })
}
