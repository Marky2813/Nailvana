import {
  FaceLandmarker,
  FilesetResolver,
  HandLandmarker,
  type FaceLandmarkerResult,
  type HandLandmarkerResult,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision'
import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'

const WASM_FILES_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
const FACE_LANDMARKER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
const HAND_LANDMARKER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
const HAND_NEAR_FACE_LANDMARK_INDICES = [0, 4, 8, 12, 16, 20]
const FACE_BOUNDS_PADDING_SCALE = 0.2

const SAMPLE_INTERVAL_MS = 250
const CALIBRATION_DURATION_MS = 3000
const SATURATION_THRESHOLD = 0.08
const CONSECUTIVE_SAMPLES_REQUIRED = 16
const LIP_REGION_COUNT = 3
const MIN_STRIP_HEIGHT_PX = 8
const REGION_LABELS = ['left', 'center', 'right'] as const
const FACE_WAIT_TIMEOUT_MS = 15000

type LipStripRect = {
  x: number
  y: number
  width: number
  height: number
}

type LipSample = {
  regionSaturations: number[]
  mouthDistance: number
}

type DetectionPhase = 'initializing' | 'calibrating' | 'monitoring' | 'triggered'

type DebugMetrics = {
  phase: DetectionPhase
  baselineSaturation: number | null
  currentSaturation: number | null
  saturationDelta: number | null
  mouthDistance: number | null
  baselineMouthDistance: number | null
  consecutiveSamples: number
  calibrationSampleCount: number
  activeRegion: string | null
  handBlocking: boolean
}

function rgbaToSaturation(red: number, green: number, blue: number) {
  const normalizedRed = red / 255
  const normalizedGreen = green / 255
  const normalizedBlue = blue / 255
  const max = Math.max(normalizedRed, normalizedGreen, normalizedBlue)
  const min = Math.min(normalizedRed, normalizedGreen, normalizedBlue)
  const delta = max - min

  return max === 0 ? 0 : delta / max
}

function averageSaturationFromPixelData(data: Uint8ClampedArray) {
  let saturationTotal = 0
  let pixelCount = 0

  for (let index = 0; index < data.length; index += 4) {
    saturationTotal += rgbaToSaturation(data[index], data[index + 1], data[index + 2])
    pixelCount += 1
  }

  if (pixelCount === 0) {
    return null
  }

  return saturationTotal / pixelCount
}

function getMouthDistance(
  landmarks: NormalizedLandmark[],
  videoWidth: number,
  videoHeight: number,
) {
  const upperLip = landmarks[13]
  const lowerLip = landmarks[14]

  if (!upperLip || !lowerLip) {
    return null
  }

  return Math.hypot(
    (lowerLip.x - upperLip.x) * videoWidth,
    (lowerLip.y - upperLip.y) * videoHeight,
  )
}

function getLipStripRect(
  landmarks: NormalizedLandmark[],
  videoWidth: number,
  videoHeight: number,
): LipStripRect | null {
  const upperLip = landmarks[13]
  const lowerLip = landmarks[14]
  const leftLip = landmarks[61]
  const rightLip = landmarks[291]

  if (!upperLip || !lowerLip || !leftLip || !rightLip) {
    return null
  }

  const leftX = leftLip.x * videoWidth
  const rightX = rightLip.x * videoWidth
  const upperY = upperLip.y * videoHeight
  const lowerY = lowerLip.y * videoHeight
  const lipGap = Math.hypot(
    (lowerLip.x - upperLip.x) * videoWidth,
    (lowerLip.y - upperLip.y) * videoHeight,
  )
  const midY = (upperY + lowerY) / 2
  const stripHeight = Math.max(MIN_STRIP_HEIGHT_PX, lipGap)
  const halfHeight = stripHeight / 2
  const x = Math.max(0, Math.floor(Math.min(leftX, rightX)))
  const right = Math.min(videoWidth, Math.ceil(Math.max(leftX, rightX)))
  const y = Math.max(0, Math.floor(midY - halfHeight))
  const bottom = Math.min(videoHeight, Math.ceil(midY + halfHeight))
  const width = right - x
  const height = bottom - y

  if (width <= 0 || height <= 0) {
    return null
  }

  return { x, y, width, height }
}

function sampleRegionSaturations(
  sampleContext: CanvasRenderingContext2D,
  stripRect: LipStripRect,
) {
  const regionSaturations: number[] = []

  for (let regionIndex = 0; regionIndex < LIP_REGION_COUNT; regionIndex += 1) {
    const regionX = Math.floor(
      stripRect.x + (stripRect.width * regionIndex) / LIP_REGION_COUNT,
    )
    const regionRight =
      regionIndex === LIP_REGION_COUNT - 1
        ? stripRect.x + stripRect.width
        : Math.floor(stripRect.x + (stripRect.width * (regionIndex + 1)) / LIP_REGION_COUNT)
    const regionWidth = regionRight - regionX

    if (regionWidth <= 0) {
      return null
    }

    const { data } = sampleContext.getImageData(
      regionX,
      stripRect.y,
      regionWidth,
      stripRect.height,
    )
    const saturation = averageSaturationFromPixelData(data)

    if (saturation === null) {
      return null
    }

    regionSaturations.push(saturation)
  }

  return regionSaturations
}

function getMaxSaturationDelta(regionSaturations: number[], baselineSaturations: number[]) {
  let maxDelta = 0
  let activeRegionIndex = 0

  regionSaturations.forEach((saturation, index) => {
    const delta = Math.abs(saturation - baselineSaturations[index])
    if (delta > maxDelta) {
      maxDelta = delta
      activeRegionIndex = index
    }
  })

  return {
    maxDelta,
    activeRegion: REGION_LABELS[activeRegionIndex] ?? null,
  }
}

function averageRegionSaturations(samples: LipSample[]) {
  if (samples.length === 0) {
    return null
  }

  const regionTotals = Array.from({ length: LIP_REGION_COUNT }, () => 0)

  samples.forEach((sample) => {
    sample.regionSaturations.forEach((saturation, index) => {
      regionTotals[index] += saturation
    })
  })

  return regionTotals.map((total) => total / samples.length)
}

function isHandNearFace(
  handLandmarks: NormalizedLandmark[][],
  faceLandmarks: NormalizedLandmark[],
  videoWidth: number,
  videoHeight: number,
) {
  if (handLandmarks.length === 0) {
    return false
  }

  let minX = 1
  let minY = 1
  let maxX = 0
  let maxY = 0

  faceLandmarks.forEach((landmark) => {
    minX = Math.min(minX, landmark.x)
    minY = Math.min(minY, landmark.y)
    maxX = Math.max(maxX, landmark.x)
    maxY = Math.max(maxY, landmark.y)
  })

  const boundsWidth = (maxX - minX) * videoWidth
  const boundsHeight = (maxY - minY) * videoHeight
  const paddingX = boundsWidth * FACE_BOUNDS_PADDING_SCALE
  const paddingY = boundsHeight * FACE_BOUNDS_PADDING_SCALE
  const left = minX * videoWidth - paddingX
  const right = maxX * videoWidth + paddingX
  const top = minY * videoHeight - paddingY
  const bottom = maxY * videoHeight + paddingY

  return handLandmarks.some((hand) =>
    HAND_NEAR_FACE_LANDMARK_INDICES.some((landmarkIndex) => {
      const point = hand[landmarkIndex]

      if (!point) {
        return false
      }

      const x = point.x * videoWidth
      const y = point.y * videoHeight

      return x >= left && x <= right && y >= top && y <= bottom
    }),
  )
}

function averageNumbers(values: number[]) {
  if (values.length === 0) {
    return null
  }

  return values.reduce((total, value) => total + value, 0) / values.length
}

let alertAudioContext: AudioContext | null = null

async function ensureAlertAudioContext() {
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

async function playChewingAlertSound() {
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

function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null)
  const handLandmarkerRef = useRef<HandLandmarker | null>(null)
  const latestFaceLandmarksRef = useRef<NormalizedLandmark[] | null>(null)
  const latestHandLandmarksRef = useRef<NormalizedLandmark[][]>([])
  const baselineSaturationsRef = useRef<number[] | null>(null)
  const baselineMouthDistanceRef = useRef<number | null>(null)
  const calibrationSamplesRef = useRef<LipSample[]>([])
  const consecutiveSamplesRef = useRef(0)
  const phaseRef = useRef<DetectionPhase>('initializing')
  const startCalibrationRef = useRef<(() => void) | null>(null)

  const [status, setStatus] = useState('')
  const [calibrationSecondsLeft, setCalibrationSecondsLeft] = useState<number | null>(null)
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null)
  const [debugMetrics, setDebugMetrics] = useState<DebugMetrics>({
    phase: 'initializing',
    baselineSaturation: null,
    currentSaturation: null,
    saturationDelta: null,
    mouthDistance: null,
    baselineMouthDistance: null,
    consecutiveSamples: 0,
    calibrationSampleCount: 0,
    activeRegion: null,
    handBlocking: false,
  })

  const updateDebugMetrics = useCallback((partial: Partial<DebugMetrics>) => {
    setDebugMetrics((current) => ({ ...current, ...partial }))
  }, [])

  useEffect(() => {
    function unlockAlertAudio() {
      void ensureAlertAudioContext()
    }

    window.addEventListener('pointerdown', unlockAlertAudio, { once: true })
    window.addEventListener('keydown', unlockAlertAudio, { once: true })

    return () => {
      window.removeEventListener('pointerdown', unlockAlertAudio)
      window.removeEventListener('keydown', unlockAlertAudio)
    }
  }, [])

  useEffect(() => {
    let stream: MediaStream | undefined
    let animationFrameId: number | undefined
    let sampleIntervalId: number | undefined
    let calibrationTimeoutId: number | undefined
    let calibrationCountdownIntervalId: number | undefined
    let triggerResetTimeoutId: number | undefined
    let isCancelled = false

    function getLipSample(): (LipSample & { stripRect: LipStripRect }) | null {
      const video = videoRef.current
      const faceLandmarks = latestFaceLandmarksRef.current

      if (!video || !faceLandmarks) {
        return null
      }

      const videoWidth = video.videoWidth
      const videoHeight = video.videoHeight

      if (videoWidth === 0 || videoHeight === 0) {
        return null
      }

      const stripRect = getLipStripRect(faceLandmarks, videoWidth, videoHeight)
      const mouthDistance = getMouthDistance(faceLandmarks, videoWidth, videoHeight)

      if (!stripRect || mouthDistance === null) {
        return null
      }

      const sampleCanvas = sampleCanvasRef.current ?? document.createElement('canvas')
      sampleCanvasRef.current = sampleCanvas
      sampleCanvas.width = videoWidth
      sampleCanvas.height = videoHeight

      const sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true })

      if (!sampleContext) {
        return null
      }

      sampleContext.drawImage(video, 0, 0, videoWidth, videoHeight)

      const regionSaturations = sampleRegionSaturations(sampleContext, stripRect)

      if (!regionSaturations) {
        return null
      }

      return { regionSaturations, mouthDistance, stripRect }
    }

    function drawOverlay(
      stripRect: LipStripRect | null,
      saturationDelta: number | null,
    ) {
      const canvas = canvasRef.current
      const video = videoRef.current
      const faceLandmarks = latestFaceLandmarksRef.current

      if (!canvas || !video || !faceLandmarks) {
        return
      }

      const videoWidth = video.videoWidth || canvas.clientWidth
      const videoHeight = video.videoHeight || canvas.clientHeight

      if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
        canvas.width = videoWidth
        canvas.height = videoHeight
      }

      const context = canvas.getContext('2d')

      if (!context) {
        return
      }

      context.clearRect(0, 0, canvas.width, canvas.height)

      const upperLip = faceLandmarks[13]
      const lowerLip = faceLandmarks[14]

      if (upperLip && lowerLip) {
        context.strokeStyle = 'rgba(255, 255, 255, 0.7)'
        context.lineWidth = 1
        context.beginPath()
        context.moveTo(upperLip.x * canvas.width, upperLip.y * canvas.height)
        context.lineTo(lowerLip.x * canvas.width, lowerLip.y * canvas.height)
        context.stroke()
      }

      if (!stripRect) {
        return
      }

      const phase = phaseRef.current
      const isCandidate =
        saturationDelta !== null && saturationDelta > SATURATION_THRESHOLD

      if (phase === 'calibrating') {
        context.strokeStyle = '#22c55e'
      } else if (phase === 'triggered') {
        context.strokeStyle = '#ef4444'
      } else if (isCandidate) {
        context.strokeStyle = '#f97316'
      } else {
        context.strokeStyle = '#eab308'
      }

      context.lineWidth = 2
      context.strokeRect(stripRect.x, stripRect.y, stripRect.width, stripRect.height)

      context.strokeStyle = 'rgba(255, 255, 255, 0.35)'
      context.lineWidth = 1
      context.setLineDash([4, 4])

      for (let regionIndex = 1; regionIndex < LIP_REGION_COUNT; regionIndex += 1) {
        const dividerX =
          stripRect.x + (stripRect.width * regionIndex) / LIP_REGION_COUNT
        context.beginPath()
        context.moveTo(dividerX, stripRect.y)
        context.lineTo(dividerX, stripRect.y + stripRect.height)
        context.stroke()
      }

      context.setLineDash([])
    }

    function handleMonitoringSample() {
      const sample = getLipSample()

      if (!sample) {
        consecutiveSamplesRef.current = 0
        updateDebugMetrics({
          phase: 'monitoring',
          consecutiveSamples: 0,
          currentSaturation: null,
          saturationDelta: null,
          mouthDistance: null,
        })
        drawOverlay(null, null)
        return
      }

      const baselineSaturations = baselineSaturationsRef.current

      if (baselineSaturations === null) {
        return
      }

      const { maxDelta: saturationDelta, activeRegion } = getMaxSaturationDelta(
        sample.regionSaturations,
        baselineSaturations,
      )
      const isCandidate = saturationDelta > SATURATION_THRESHOLD
      const averageCurrentSaturation =
        sample.regionSaturations.reduce((total, value) => total + value, 0) /
        sample.regionSaturations.length
      const averageBaselineSaturation =
        baselineSaturations.reduce((total, value) => total + value, 0) /
        baselineSaturations.length

      if (isCandidate) {
        consecutiveSamplesRef.current += 1
      } else {
        consecutiveSamplesRef.current = 0
      }

      updateDebugMetrics({
        phase: 'monitoring',
        baselineSaturation: averageBaselineSaturation,
        currentSaturation: averageCurrentSaturation,
        saturationDelta,
        mouthDistance: sample.mouthDistance,
        baselineMouthDistance: baselineMouthDistanceRef.current,
        consecutiveSamples: consecutiveSamplesRef.current,
        activeRegion,
      })

      drawOverlay(sample.stripRect, saturationDelta)

      if (consecutiveSamplesRef.current >= CONSECUTIVE_SAMPLES_REQUIRED) {
        consecutiveSamplesRef.current = 0
        phaseRef.current = 'triggered'
        setTriggerMessage('Chewing detected')
        void playChewingAlertSound()
        console.log('chewing detected', {
          saturationDelta,
          activeRegion,
          regionSaturations: sample.regionSaturations,
          baselineSaturations,
        })

        updateDebugMetrics({
          phase: 'triggered',
          consecutiveSamples: 0,
        })

        drawOverlay(sample.stripRect, saturationDelta)

        if (triggerResetTimeoutId !== undefined) {
          clearTimeout(triggerResetTimeoutId)
        }

        triggerResetTimeoutId = window.setTimeout(() => {
          phaseRef.current = 'monitoring'
          setTriggerMessage(null)
          updateDebugMetrics({ phase: 'monitoring' })
        }, 2000)
      }
    }

    function startSamplingLoop() {
      if (sampleIntervalId !== undefined) {
        clearInterval(sampleIntervalId)
      }

      sampleIntervalId = window.setInterval(() => {
        const phase = phaseRef.current

        if (phase === 'calibrating') {
          const sample = getLipSample()

          if (sample) {
            calibrationSamplesRef.current.push({
              regionSaturations: sample.regionSaturations,
              mouthDistance: sample.mouthDistance,
            })
            drawOverlay(sample.stripRect, null)
            const averageSaturation =
              sample.regionSaturations.reduce((total, value) => total + value, 0) /
              sample.regionSaturations.length
            updateDebugMetrics({
              calibrationSampleCount: calibrationSamplesRef.current.length,
              currentSaturation: averageSaturation,
              mouthDistance: sample.mouthDistance,
            })
          }

          return
        }

        if (phase === 'monitoring' || phase === 'triggered') {
          handleMonitoringSample()
        }
      }, SAMPLE_INTERVAL_MS)
    }

    function startCalibration() {
      calibrationSamplesRef.current = []
      baselineSaturationsRef.current = null
      baselineMouthDistanceRef.current = null
      consecutiveSamplesRef.current = 0
      phaseRef.current = 'calibrating'
      setTriggerMessage(null)
      setStatus('')
      setCalibrationSecondsLeft(Math.ceil(CALIBRATION_DURATION_MS / 1000))

      updateDebugMetrics({
        phase: 'calibrating',
        baselineSaturation: null,
        currentSaturation: null,
        saturationDelta: null,
        mouthDistance: null,
        baselineMouthDistance: null,
        consecutiveSamples: 0,
        calibrationSampleCount: 0,
        activeRegion: null,
      })

      if (calibrationTimeoutId !== undefined) {
        clearTimeout(calibrationTimeoutId)
      }

      if (calibrationCountdownIntervalId !== undefined) {
        clearInterval(calibrationCountdownIntervalId)
      }

      calibrationCountdownIntervalId = window.setInterval(() => {
        setCalibrationSecondsLeft((secondsLeft) =>
          secondsLeft === null ? null : Math.max(1, secondsLeft - 1),
        )
      }, 1000)

      calibrationTimeoutId = window.setTimeout(() => {
        if (calibrationCountdownIntervalId !== undefined) {
          clearInterval(calibrationCountdownIntervalId)
        }

        setCalibrationSecondsLeft(null)

        const baselineSaturations = averageRegionSaturations(calibrationSamplesRef.current)
        const mouthDistances = calibrationSamplesRef.current.map(
          (sample) => sample.mouthDistance,
        )
        const baselineMouthDistance = averageNumbers(mouthDistances)
        const averageBaselineSaturation =
          baselineSaturations === null
            ? null
            : baselineSaturations.reduce((total, value) => total + value, 0) /
              baselineSaturations.length

        if (baselineSaturations === null || baselineMouthDistance === null) {
          setStatus(
            `Calibration failed — collected ${calibrationSamplesRef.current.length} samples. Keep your face in frame and recalibrate.`,
          )
          phaseRef.current = 'initializing'
          updateDebugMetrics({ phase: 'initializing' })
          return
        }

        setStatus('')
        baselineSaturationsRef.current = baselineSaturations
        baselineMouthDistanceRef.current = baselineMouthDistance
        phaseRef.current = 'monitoring'

        updateDebugMetrics({
          phase: 'monitoring',
          baselineSaturation: averageBaselineSaturation,
          baselineMouthDistance,
          currentSaturation: null,
          saturationDelta: null,
          mouthDistance: null,
          consecutiveSamples: 0,
          activeRegion: null,
        })

        console.log('Calibration complete', {
          baselineSaturations,
          baselineMouthDistance,
        })
      }, CALIBRATION_DURATION_MS)
    }

    startCalibrationRef.current = startCalibration

    async function initializeMediaPipe() {
      const vision = await FilesetResolver.forVisionTasks(WASM_FILES_URL)

      const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: FACE_LANDMARKER_MODEL_URL,
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: false,
      })

      faceLandmarkerRef.current = faceLandmarker
    }

    function waitForVideoDimensions(video: HTMLVideoElement) {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        return Promise.resolve()
      }

      return new Promise<void>((resolve) => {
        video.addEventListener('loadedmetadata', () => resolve(), { once: true })
      })
    }

    function waitForFaceDetection() {
      const startedAt = Date.now()

      return new Promise<boolean>((resolve) => {
        const checkForFace = () => {
          if (isCancelled) {
            resolve(false)
            return
          }

          if (latestFaceLandmarksRef.current !== null) {
            resolve(true)
            return
          }

          if (Date.now() - startedAt >= FACE_WAIT_TIMEOUT_MS) {
            resolve(false)
            return
          }

          window.setTimeout(checkForFace, 100)
        }

        checkForFace()
      })
    }

    async function startWebcam() {
      try {
        setStatus('Loading face detection models…')
        await initializeMediaPipe()

        if (isCancelled) {
          return
        }

        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera API is not available in this environment')
        }

        setStatus('Requesting camera access…')
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        })

        if (isCancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        const video = videoRef.current

        if (!video) {
          return
        }

        video.srcObject = stream
        await video.play()
        await waitForVideoDimensions(video)

        if (isCancelled) {
          return
        }

        startDetectionLoop()
        startSamplingLoop()

        setStatus('Looking for your face…')
        const hasFace = await waitForFaceDetection()

        if (isCancelled) {
          return
        }

        if (!hasFace) {
          setStatus('No face detected — position yourself in frame and click Recalibrate')
          phaseRef.current = 'initializing'
          updateDebugMetrics({ phase: 'initializing' })
          return
        }

        setStatus('')
        startCalibration()
      } catch (error) {
        if (isCancelled) {
          return
        }

        console.error('Failed to start webcam pipeline', error)

        const message =
          error instanceof Error ? error.message : 'Unknown startup error'

        if (message.toLowerCase().includes('permission')) {
          setStatus('Camera permission denied — allow camera access and restart')
        } else if (message.toLowerCase().includes('found') || message.includes('model')) {
          setStatus(`Model load failed — check your internet connection (${message})`)
        } else {
          setStatus(`Startup failed: ${message}`)
        }

        phaseRef.current = 'initializing'
        updateDebugMetrics({ phase: 'initializing' })
      }
    }

    function startDetectionLoop() {
      const video = videoRef.current
      const faceLandmarker = faceLandmarkerRef.current

      if (!video || !faceLandmarker) {
        return
      }

      const detectFrame = () => {
        const timestamp = performance.now()
        const result: FaceLandmarkerResult = faceLandmarker.detectForVideo(video, timestamp)
        latestFaceLandmarksRef.current = result.faceLandmarks[0] ?? null
        animationFrameId = requestAnimationFrame(detectFrame)
      }

      detectFrame()
    }

    startWebcam()

    return () => {
      isCancelled = true

      if (animationFrameId !== undefined) {
        cancelAnimationFrame(animationFrameId)
      }

      if (sampleIntervalId !== undefined) {
        clearInterval(sampleIntervalId)
      }

      if (calibrationTimeoutId !== undefined) {
        clearTimeout(calibrationTimeoutId)
      }

      if (calibrationCountdownIntervalId !== undefined) {
        clearInterval(calibrationCountdownIntervalId)
      }

      if (triggerResetTimeoutId !== undefined) {
        clearTimeout(triggerResetTimeoutId)
      }

      stream?.getTracks().forEach((track) => track.stop())
      faceLandmarkerRef.current?.close()
    }
  }, [updateDebugMetrics])

  async function handleRecalibrate() {
    if (latestFaceLandmarksRef.current === null) {
      setStatus('No face detected — position yourself in frame and try again')
      return
    }

    setStatus('')
    await ensureAlertAudioContext()
    startCalibrationRef.current?.()
  }

  function formatMetric(value: number | null, digits = 3) {
    return value === null ? '—' : value.toFixed(digits)
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-4 bg-zinc-950 px-6 py-8 text-zinc-100">
      <div className="text-2xl font-semibold">CatchChew</div>

      <div className="relative aspect-video w-full max-w-3xl overflow-hidden rounded-lg border border-zinc-800 bg-black">
        <video
          ref={videoRef}
          className="webcam h-full w-full object-cover"
          autoPlay
          muted
        ></video>
        <canvas
          ref={canvasRef}
          id="canvas"
          className="pointer-events-none absolute inset-0 h-full w-full"
        ></canvas>
        {calibrationSecondsLeft !== null && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-center text-white">
            <div className="text-5xl font-semibold tabular-nums">
              {calibrationSecondsLeft}
            </div>
            <div className="mt-3 text-lg font-medium">
              Calibrating — keep your mouth closed
            </div>
          </div>
        )}
        {triggerMessage !== null && (
          <div className="absolute inset-x-0 top-4 flex justify-center">
            <div className="rounded-lg bg-red-600/90 px-4 py-2 text-sm font-semibold text-white">
              {triggerMessage}
            </div>
          </div>
        )}
      </div>

      <div className="w-full max-w-3xl rounded-lg border border-zinc-800 bg-zinc-900 p-4 font-mono text-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-sans text-base font-medium text-zinc-200">Debug HUD</div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void playChewingAlertSound()}
              className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1 font-sans text-xs text-zinc-200 hover:bg-zinc-700"
            >
              Test sound
            </button>
            <button
              type="button"
              onClick={() => void handleRecalibrate()}
              className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1 font-sans text-xs text-zinc-200 hover:bg-zinc-700"
            >
              Recalibrate
            </button>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            State: <span className="text-emerald-400">{debugMetrics.phase}</span>
          </div>
          <div>
            Consecutive samples:{' '}
            <span className="text-sky-400">
              {debugMetrics.consecutiveSamples} / {CONSECUTIVE_SAMPLES_REQUIRED}
            </span>
          </div>
          <div>Baseline saturation: {formatMetric(debugMetrics.baselineSaturation)}</div>
          <div>Current saturation: {formatMetric(debugMetrics.currentSaturation)}</div>
          <div>
            Max region delta:{' '}
            <span
              className={
                debugMetrics.saturationDelta !== null &&
                debugMetrics.saturationDelta > SATURATION_THRESHOLD
                  ? 'text-orange-400'
                  : 'text-zinc-300'
              }
            >
              {formatMetric(debugMetrics.saturationDelta)}
            </span>
          </div>
          <div>
            Active region:{' '}
            <span className="text-sky-400">{debugMetrics.activeRegion ?? '—'}</span>
          </div>
          <div>Threshold: {SATURATION_THRESHOLD.toFixed(3)}</div>
          <div>Baseline mouth distance: {formatMetric(debugMetrics.baselineMouthDistance, 1)}</div>
          <div>Mouth distance: {formatMetric(debugMetrics.mouthDistance, 1)}</div>
          <div>
            Calibration samples:{' '}
            <span className="text-sky-400">{debugMetrics.calibrationSampleCount}</span>
          </div>
        </div>
        <div className="mt-3 font-sans text-xs text-zinc-500">
          One strip spans the full mouth (landmarks 61–291), split into left / center / right.
          Detection uses the highest delta in any region for{' '}
          {CONSECUTIVE_SAMPLES_REQUIRED} consecutive samples ({(CONSECUTIVE_SAMPLES_REQUIRED * SAMPLE_INTERVAL_MS) / 1000}s).
        </div>
      </div>

      <div className="status min-h-6 text-sm text-red-300">{status}</div>
    </main>
  )
}

export default App
