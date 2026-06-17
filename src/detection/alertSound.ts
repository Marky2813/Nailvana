import pingSoundUrl from '../ui/assets/ping.mp3'

const ALERT_VOLUME = 0.5
let alertAudio: HTMLAudioElement | null = null

export async function ensureAlertAudio() {
  if (!alertAudio) {
    alertAudio = new Audio(pingSoundUrl)
    alertAudio.preload = 'auto'
    alertAudio.volume = ALERT_VOLUME
    alertAudio.load()
  }

  alertAudio.volume = ALERT_VOLUME

  return alertAudio
}

export async function playChewingAlertSound() {
  try {
    const audio = await ensureAlertAudio()
    audio.pause()
    audio.currentTime = 0
    await audio.play()
  } catch (error) {
    console.warn('Could not play chewing alert sound', error)
  }
}

export function unlockAlertAudioOnInteraction() {
  async function unlockAlertAudio() {
    const audio = await ensureAlertAudio()

    try {
      audio.muted = true
      await audio.play()
      audio.pause()
      audio.currentTime = 0
    } catch {
      // The next user interaction or detection trigger can try again.
    } finally {
      audio.muted = false
    }
  }

  window.addEventListener('pointerdown', unlockAlertAudio, { once: true })
  window.addEventListener('keydown', unlockAlertAudio, { once: true })

  return () => {
    window.removeEventListener('pointerdown', unlockAlertAudio)
    window.removeEventListener('keydown', unlockAlertAudio)
  }
}
