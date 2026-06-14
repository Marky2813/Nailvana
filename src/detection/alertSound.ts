let alertAudioContext: AudioContext | null = null

export async function ensureAlertAudioContext() {
  if (!alertAudioContext) {
    const AudioContextClass =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

    if (!AudioContextClass) {
      return null
    }

    alertAudioContext = new AudioContextClass()
  }

  if (alertAudioContext.state === 'suspended') {
    await alertAudioContext.resume()
  }

  return alertAudioContext
}

function playSoftChimeNote(
  context: AudioContext,
  frequency: number,
  startTime: number,
  volume: number,
  duration: number,
) {
  const oscillator = context.createOscillator()
  const gain = context.createGain()

  oscillator.type = 'triangle'
  oscillator.frequency.setValueAtTime(frequency, startTime)

  gain.gain.setValueAtTime(0, startTime)
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)

  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start(startTime)
  oscillator.stop(startTime + duration + 0.05)
}

export async function playChewingAlertSound() {
  try {
    const context = await ensureAlertAudioContext()

    if (!context || context.state !== 'running') {
      return
    }

    const startTime = context.currentTime + 0.01

    playSoftChimeNote(context, 587, startTime, 0.09, 0.2)
    playSoftChimeNote(context, 784, startTime + 0.14, 0.08, 0.26)
  } catch (error) {
    console.warn('Could not play chewing alert sound', error)
  }
}

export function unlockAlertAudioOnInteraction() {
  function unlockAlertAudio() {
    void ensureAlertAudioContext()
  }

  window.addEventListener('pointerdown', unlockAlertAudio, { once: true })
  window.addEventListener('keydown', unlockAlertAudio, { once: true })

  return () => {
    window.removeEventListener('pointerdown', unlockAlertAudio)
    window.removeEventListener('keydown', unlockAlertAudio)
  }
}
