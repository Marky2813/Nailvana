import { useEffect, useRef, useState } from 'react'
import './App.css'
import { CameraView } from '../components/CameraView'
import { useChewingDetection } from '../hooks/useChewingDetection'
import nailvanalogo from './assets/Nailvana.png'
import Box from '@mui/material/Box'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import Select, { type SelectChangeEvent } from '@mui/material/Select'

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

function getBiteNotificationMessage(triggerMessage: string | null) {
  if (triggerMessage === null) {
    return null
  }

  return "Take a breath, you've got this"
}


function App() {
  const [status, setStatus] = useState('Active')
  const isDetectionEnabled = status === 'Active'
  const { videoRef, canvasRef, triggerMessage, debugMetrics } = useChewingDetection({
    enabled: isDetectionEnabled,
  })
  const [catchCount, setCatchCount] = useState(() => loadDailyCatches())
  const previousTriggerRef = useRef<string | null>(null)
  const position = isDetectionEnabled
    ? getPositionLabel(debugMetrics.trackingValid, debugMetrics.trackingIssue)
    : 'Inactive'
  const biteNotificationMessage = getBiteNotificationMessage(triggerMessage)

  const handleChange = (event: SelectChangeEvent) => {
    setStatus(event.target.value)
  }

  useEffect(() => {
    const wasIdle = previousTriggerRef.current === null

    if (isDetectionEnabled && triggerMessage !== null && wasIdle) {
      const notificationMessage = getBiteNotificationMessage(triggerMessage)

      if (notificationMessage !== null) {
        window.electron?.fireNotification?.(notificationMessage)
      }

      setCatchCount((currentCount) => {
        const nextCount = currentCount + 1
        saveDailyCatches(nextCount)
        return nextCount
      })
    }

    previousTriggerRef.current = triggerMessage
  }, [isDetectionEnabled, triggerMessage])

  useEffect(() => {
    saveDailyCatches(catchCount)
  }, [catchCount])

  return (
    <main className="nailvana-shell">
      <CameraView
        videoRef={videoRef}
        canvasRef={canvasRef}
        triggerMessage={triggerMessage}
        isSleeping={!isDetectionEnabled}
      />
      {biteNotificationMessage !== null && (
        <div className="bite-notification" role="status" aria-live="polite">
          <span className="bite-notification-dot" />
          <span>{biteNotificationMessage}</span>
        </div>
      )}

      <div className="brand-tab">
        <img src={nailvanalogo} alt="Nailvana Logo" className="brand-logo mt-3 -ml-3 -mr-4" />
        <div className="brand-title mt-2">Nailvana</div>
      </div>
      <div className="algin-center flex flex-col items-center">
        <section className="metrics-panel flex flex-col items-center text-center">
          <div className="mt-[18px] metric-label -mb-7">Status</div>
          <div className="mt-[8px] flex items-center justify-center gap-[9px]">
            <Box sx={{ 
              minWidth: 120,
              height: 30,
              padding: 0, 
              margin: 1.3 }}>
              <FormControl fullWidth>
                <Select
                  labelId="demo-simple-select-label"
                  id="demo-simple-select"
                  value={status}
                  label="Status"
                  onChange={handleChange}
                  sx={{
                    '& .MuiOutlinedInput-notchedOutline': {
                      border: 'none',
                    },
                  }}
                >
                  <MenuItem value="Active"><span className="status-dot-active mr-2" ></span>
                    <span className="metric-value">Active</span></MenuItem>
                  <MenuItem value="Inactive"><span className="status-dot-inactive mr-2" ></span>
                    <span className="metric-value">Inactive</span></MenuItem>
                </Select>
              </FormControl>
            </Box>

          </div>

          <div className="mt-[18px] metric-label">Catches</div>
          <div className="mt-[8px] metric-value">{catchCount}</div>
          <div className="mt-[2px] metric-today">Today</div>

          <div className="mt-[18px] metric-label">Position</div>
          <div className="mt-[4px] metric-value ">{position}</div>

          <div className="mt-[15px] footer-copy">
            Please stay centered in the frame with constant lighting to ensure accurate tracking.
          </div>
        </section>
      </div>
    </main>
  )
}

export default App
