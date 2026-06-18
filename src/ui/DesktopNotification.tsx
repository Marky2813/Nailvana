import { useEffect, useState } from 'react'
import './DesktopNotification.css'

const DEFAULT_NOTIFICATION_MESSAGE = "Take a breath, you've got this"

export function DesktopNotification() {
  const [message, setMessage] = useState(DEFAULT_NOTIFICATION_MESSAGE)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const removeShowListener = window.electron?.onDesktopNotificationShow?.((nextMessage) => {
      setMessage(nextMessage || DEFAULT_NOTIFICATION_MESSAGE)
      setIsVisible(true)
    })
    const removeHideListener = window.electron?.onDesktopNotificationHide?.(() => {
      setIsVisible(false)
    })

    window.electron?.desktopNotificationReady?.()

    return () => {
      removeShowListener?.()
      removeHideListener?.()
    }
  }, [])

  return (
    <main className="desktop-notification-shell">
      <div className={`desktop-notification-pill${isVisible ? ' is-visible' : ''}`}>
        <span className="desktop-notification-dot" />
        <span className="desktop-notification-message">{message}</span>
      </div>
    </main>
  )
}
