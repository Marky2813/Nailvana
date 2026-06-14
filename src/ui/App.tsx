import { useEffect, useRef, useState } from 'react'
import './App.css'
import { CameraView } from '../components/CameraView'
import { useChewingDetection } from '../hooks/useChewingDetection'

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

function NailvanaIcon() {
  return (
    <svg className="brand-icon" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="15" fill="none" stroke="#ff5c00" strokeWidth="1.8" />
      <path
        d="M12.5 12.7c.3-3 2-5 4-5s3.7 2 4 5l.7 8.5c.2 2.5-1.8 4.6-4.7 4.6s-4.9-2.1-4.7-4.6l.7-8.5Z"
        fill="none"
        stroke="#ff5c00"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M14.2 15.7c1.4 1 3.2 1 4.6 0M14.2 20.1c1.5 1.1 3.3 1.1 4.8 0"
        fill="none"
        stroke="#ff5c00"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
      <path
        d="m22.8 6.4.9 2.1 2.2.3-1.6 1.5.4 2.2-1.9-1.1-2 1.1.4-2.2-1.6-1.5 2.2-.3.9-2.1Z"
        fill="#ff5c00"
      />
    </svg>
  )
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
        <NailvanaIcon />
        <div className="brand-title">Nailvana</div>
      </div>

      <section className="metrics-panel flex flex-col items-center text-center">
        <div className="mt-[31px] metric-label">Status</div>
        <div className="mt-[8px] flex items-center justify-center gap-[9px]">
          <span className="status-dot"></span>
          <span className="metric-value">{isActive ? 'Active' : 'Starting'}</span>
        </div>

        <div className="mt-[30px] metric-label">Catches</div>
        <div className="mt-[9px] metric-value">{catchCount}</div>

        <div className="mt-[31px] metric-label">Position</div>
        <div className="mt-[8px] metric-value">{position}</div>

        <div className="mt-[39px] footer-copy">
          Please stay centered in the frame with constant lighting to ensure accurate tracking.
        </div>
      </section>
    </main>
  )
}

export default App
