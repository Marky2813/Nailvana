import { useEffect, useRef, useState } from 'react'
import './App.css'
import { CameraView } from '../components/CameraView'
import { useChewingDetection } from '../hooks/useChewingDetection'
import nailvanalogo from './assets/Nailvana.png'

const CATCH_STORAGE_KEY = 'nailvana:catches'

type StoredCatches = {
  date: string
  count: number
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10)
}

function loadDailyCatches() {
  try {
    const stored = window.localStorage.getItem(CATCH_STORAGE_KEY)

    if (!stored) {
      return 0
    }

    const parsed = JSON.parse(stored) as StoredCatches

    return parsed.date === getTodayKey() ? parsed.count : 0
  } catch {
    return 0
  }
}

function saveDailyCatches(count: number) {
  const payload: StoredCatches = {
    date: getTodayKey(),
    count,
  }

  window.localStorage.setItem(CATCH_STORAGE_KEY, JSON.stringify(payload))
}

function getPositionLabel(trackingValid: boolean, trackingIssue: string | null) {
  if (trackingValid) {
    return 'Centered'
  }

  if (trackingIssue === 'face not detected') {
    return 'Not in frame'
  }

  if (trackingIssue === 'face too far') {
    return 'Too far'
  }

  if (trackingIssue === 'face too close') {
    return 'Too close'
  }

  if (trackingIssue === 'recenter face' || trackingIssue === 'mouth near frame edge') {
    return 'Off center'
  }

  return 'Not in frame'
}


function App() {
  const { videoRef, canvasRef, triggerMessage, debugMetrics } = useChewingDetection()
  const [catchCount, setCatchCount] = useState(() => loadDailyCatches())
  const previousTriggerRef = useRef<string | null>(null)
  const isActive = debugMetrics.phase === 'monitoring' || debugMetrics.phase === 'triggered'
  const position = getPositionLabel(debugMetrics.trackingValid, debugMetrics.trackingIssue)

  useEffect(() => {
    const wasIdle = previousTriggerRef.current === null

    if (triggerMessage !== null && wasIdle) {
      setCatchCount((currentCount) => {
        const nextCount = currentCount + 1
        saveDailyCatches(nextCount)
        return nextCount
      })
    }

    previousTriggerRef.current = triggerMessage
  }, [triggerMessage])

  useEffect(() => {
    saveDailyCatches(catchCount)
  }, [catchCount])

  return (
    <main className="nailvana-shell">
      <CameraView videoRef={videoRef} canvasRef={canvasRef} triggerMessage={triggerMessage} />

      <div className="brand-tab">
        <img src={nailvanalogo} alt="Nailvana Logo" className="brand-logo mt-3 -ml-3 -mr-4" />
        <div className="brand-title mt-2">Nailvana</div>
      </div>
    <div className="algin-center flex flex-col items-center">
      <section className="metrics-panel flex flex-col items-center text-center">
        <div className="mt-[18px] metric-label">Status</div>
        <div className="mt-[8px] flex items-center justify-center gap-[9px]">
          <span className="status-dot"></span>
          <span className="metric-value">{isActive ? 'Active' : 'Starting'}</span>
        </div>

        <div className="mt-[18px] metric-label">Catches</div>
        <div className="mt-[8px] metric-value">{catchCount}</div>

        <div className="mt-[18px] metric-label">Position</div>
        <div className="mt-[8px] metric-value">{position}</div>

        <div className="mt-[22px] footer-copy">
          Please stay centered in the frame with constant lighting to ensure accurate tracking.
        </div>
      </section>
    </div>
    </main>
  )
}

export default App
