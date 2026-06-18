export {}

declare global {
  interface Window {
    electron?: {
      sayHello?: () => void
      fireNotification?: (message: string) => void
      desktopNotificationReady?: () => void
      onDesktopNotificationShow?: (callback: (message: string) => void) => () => void
      onDesktopNotificationHide?: (callback: () => void) => () => void
    }
  }
}
