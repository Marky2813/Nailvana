import type { FaceLandmarker, HandLandmarker } from '@mediapipe/tasks-vision'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ensureAlertAudioContext, playChewingAlertSound, unlockAlertAudioOnInteraction } from '../detection/alertSound'
import {
  CALIBRATION_DURATION_MS,
  FACE_WAIT_TIMEOUT_MS,
  SAMPLE_INTERVAL_MS,
  TRIGGER_RESET_MS,
} from '../detection/constants'
import {
  initializeMediaPipeLandmarkers,
  waitForVideoDimensions,
} from '../detection/mediapipe'
import {
  finalizeCalibration,
  getCalibratingMetricsReset,
  getMissingFrameMetrics,
  getMonitoringMetricsAfterCalibration,
  evaluateMonitoringFrame,
} from '../detection/monitoring'
import { sampleMouthCropFromVideo, type MouthCropBaseline, type MouthCropSample } from '../detection/mouthCrop'
import { drawDetectionOverlay } from '../detection/overlay'
import { INITIAL_DEBUG_METRICS, type DebugMetrics, type DetectionPhase, type DetectionReason } from '../detection/types'

type UseChewingDetectionOptions = {
  enabled?: boolean
}

export function useChewingDetection({ enabled = true }: UseChewingDetectionOptions = {}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null)
  const handLandmarkerRef = useRef<HandLandmarker | null>(null)
  const latestFaceLandmarksRef = useRef<NormalizedLandmark[] | null>(null)
  const latestHandLandmarksRef = useRef<NormalizedLandmark[][]>([])
  const baselineRef = useRef<MouthCropBaseline | null>(null)
  const calibrationSamplesRef = useRef<MouthCropSample[]>([])
  const mouthDistanceHistoryRef = useRef<number[]>([])
  const consecutiveContactSamplesRef = useRef(0)
  const consecutiveMotionSamplesRef = useRef(0)
  const consecutiveHandMouthSamplesRef = useRef(0)
  const phaseRef = useRef<DetectionPhase>('initializing')
  const startCalibrationRef = useRef<(() => void) | null>(null)

  const [status, setStatus] = useState('')
  const [calibrationSecondsLeft, setCalibrationSecondsLeft] = useState<number | null>(null)
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null)
  const [debugMetrics, setDebugMetrics] = useState<DebugMetrics>(INITIAL_DEBUG_METRICS)

  const updateDebugMetrics = useCallback((partial: Partial<DebugMetrics>) => {
    setDebugMetrics((current) => ({ ...current, ...partial }))
  }, [])

  useEffect(() => unlockAlertAudioOnInteraction(), [])

  useEffect(() => {
    if (!enabled) {
      const canvas = canvasRef.current
      const video = videoRef.current
      const resetTimeoutId = window.setTimeout(() => {
        setStatus('Inactive')
        setCalibrationSecondsLeft(null)
        setTriggerMessage(null)
        updateDebugMetrics({
          ...INITIAL_DEBUG_METRICS,
          trackingIssue: 'inactive',
        })
      }, 0)

      phaseRef.current = 'initializing'
      startCalibrationRef.current = null
      latestFaceLandmarksRef.current = null
      latestHandLandmarksRef.current = []
      baselineRef.current = null
      calibrationSamplesRef.current = []
      mouthDistanceHistoryRef.current = []
      consecutiveContactSamplesRef.current = 0
      consecutiveMotionSamplesRef.current = 0
      consecutiveHandMouthSamplesRef.current = 0

      if (video) {
        video.pause()
        video.srcObject = null
      }

      const context = canvas?.getContext('2d')
      context?.clearRect(0, 0, canvas?.width ?? 0, canvas?.height ?? 0)

      return () => {
        clearTimeout(resetTimeoutId)
      }
    }

    const cleanupVideo = videoRef.current
    let stream: MediaStream | undefined
    let animationFrameId: number | undefined
    let sampleIntervalId: number | undefined
    let calibrationTimeoutId: number | undefined
    let calibrationCountdownIntervalId: number | undefined
    let triggerResetTimeoutId: number | undefined
    let isCancelled = false

    function drawCurrentOverlay(
      mouthRect: Parameters<typeof drawDetectionOverlay>[0]['mouthRect'],
      confidence: number | null,
    ) {
      const canvas = canvasRef.current
      const video = videoRef.current
      const faceLandmarks = latestFaceLandmarksRef.current

      if (!canvas || !video || !faceLandmarks) {
        return
      }

      drawDetectionOverlay({
        canvas,
        video,
        faceLandmarks,
        mouthRect,
        phase: phaseRef.current,
        confidence,
      })
    }

    function triggerDetection(
      reason: DetectionReason,
      mouthRect: Parameters<typeof drawDetectionOverlay>[0]['mouthRect'],
      confidence: number | null,
      details: Record<string, unknown>,
    ) {
      consecutiveContactSamplesRef.current = 0
      consecutiveMotionSamplesRef.current = 0
      consecutiveHandMouthSamplesRef.current = 0
      phaseRef.current = 'triggered'
      setTriggerMessage(
        reason === 'hand'
          ? 'Hand-to-mouth detected'
          : reason === 'motion'
            ? 'Chewing motion detected'
            : 'Mouth contact detected',
      )
      void playChewingAlertSound()
      console.log(`${reason} detected`, details)

      updateDebugMetrics({
        phase: 'triggered',
        contactSamples: 0,
        motionSamples: 0,
        handNearMouthSamples: 0,
      })

      drawCurrentOverlay(mouthRect, confidence)

      if (triggerResetTimeoutId !== undefined) {
        clearTimeout(triggerResetTimeoutId)
      }

      triggerResetTimeoutId = window.setTimeout(() => {
        phaseRef.current = 'monitoring'
        setTriggerMessage(null)
        updateDebugMetrics({ phase: 'monitoring' })
      }, TRIGGER_RESET_MS)
    }

    function handleMonitoringSample() {
      const video = videoRef.current
      const faceLandmarks = latestFaceLandmarksRef.current

      if (!video || !faceLandmarks) {
        mouthDistanceHistoryRef.current = []
        consecutiveContactSamplesRef.current = 0
        consecutiveMotionSamplesRef.current = 0
        consecutiveHandMouthSamplesRef.current = 0
        updateDebugMetrics(getMissingFrameMetrics())
        drawCurrentOverlay(null, null)
        return
      }

      const result = evaluateMonitoringFrame({
        video,
        faceLandmarks,
        handLandmarks: latestHandLandmarksRef.current,
        sampleCanvas: sampleCanvasRef.current,
        state: {
          baseline: baselineRef.current,
          mouthDistanceHistory: mouthDistanceHistoryRef.current,
          consecutiveContactSamples: consecutiveContactSamplesRef.current,
          consecutiveMotionSamples: consecutiveMotionSamplesRef.current,
          consecutiveHandMouthSamples: consecutiveHandMouthSamplesRef.current,
        },
      })

      if (result.kind === 'missing') {
        mouthDistanceHistoryRef.current = []
        consecutiveContactSamplesRef.current = 0
        consecutiveMotionSamplesRef.current = 0
        consecutiveHandMouthSamplesRef.current = 0
        updateDebugMetrics(getMissingFrameMetrics())
        drawCurrentOverlay(null, null)
        return
      }

      if (result.kind === 'no-baseline') {
        return
      }

      sampleCanvasRef.current = result.sampleCanvas
      baselineRef.current = result.nextState.baseline
      mouthDistanceHistoryRef.current = result.nextState.mouthDistanceHistory
      consecutiveContactSamplesRef.current = result.nextState.consecutiveContactSamples
      consecutiveMotionSamplesRef.current = result.nextState.consecutiveMotionSamples
      consecutiveHandMouthSamplesRef.current = result.nextState.consecutiveHandMouthSamples
      updateDebugMetrics(result.metrics)
      if (result.metrics.trackingValid === false) {
        setStatus(`Tracking unstable: ${result.metrics.trackingIssue ?? 'recenter face'}`)
      } else if (result.metrics.trackingValid === true) {
        setStatus('')
      }
      drawCurrentOverlay(result.sample.rect, result.metrics.finalConfidence ?? null)

      if (result.trigger) {
        triggerDetection(
          result.trigger,
          result.sample.rect,
          result.metrics.finalConfidence ?? null,
          result.triggerDetails,
        )
      }
    }

    function startSamplingLoop() {
      if (sampleIntervalId !== undefined) {
        clearInterval(sampleIntervalId)
      }

      sampleIntervalId = window.setInterval(() => {
        const phase = phaseRef.current

        if (phase === 'calibrating') {
          const video = videoRef.current
          const faceLandmarks = latestFaceLandmarksRef.current

          if (!video || !faceLandmarks) {
            return
          }

          const sampled = sampleMouthCropFromVideo(video, faceLandmarks, sampleCanvasRef.current)

          if (!sampled || !sampled.trackingQuality.valid) {
            updateDebugMetrics({
              trackingValid: false,
              trackingIssue: sampled?.trackingQuality.reason ?? 'mouth crop unavailable',
            })
            return
          }

          sampleCanvasRef.current = sampled.sampleCanvas
          calibrationSamplesRef.current.push(sampled)
          drawCurrentOverlay(sampled.rect, null)
          updateDebugMetrics({
            trackingValid: true,
            trackingIssue: null,
            calibrationSampleCount: calibrationSamplesRef.current.length,
            mouthCropBrightness: sampled.brightness,
            mouthCropContrast: sampled.contrast,
            mouthDistance: sampled.mouthDistance,
          })

          return
        }

        if (phase === 'monitoring' || phase === 'triggered') {
          handleMonitoringSample()
        }
      }, SAMPLE_INTERVAL_MS)
    }

    function startCalibration() {
      calibrationSamplesRef.current = []
      baselineRef.current = null
      mouthDistanceHistoryRef.current = []
      consecutiveContactSamplesRef.current = 0
      consecutiveMotionSamplesRef.current = 0
      consecutiveHandMouthSamplesRef.current = 0
      phaseRef.current = 'calibrating'
      setTriggerMessage(null)
      setStatus('')
      setCalibrationSecondsLeft(Math.ceil(CALIBRATION_DURATION_MS / 1000))
      updateDebugMetrics(getCalibratingMetricsReset())

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

        const calibrationResult = finalizeCalibration(calibrationSamplesRef.current)

        if (!calibrationResult) {
          setStatus(
            `Calibration failed — collected ${calibrationSamplesRef.current.length} samples. Keep your face in frame and recalibrate.`,
          )
          phaseRef.current = 'initializing'
          updateDebugMetrics({ phase: 'initializing' })
          return
        }

        setStatus('')
        baselineRef.current = calibrationResult
        phaseRef.current = 'monitoring'

        updateDebugMetrics(getMonitoringMetricsAfterCalibration(calibrationResult))

        console.log('Calibration complete', calibrationResult)
      }, CALIBRATION_DURATION_MS)
    }

    startCalibrationRef.current = startCalibration

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

    function startDetectionLoop() {
      const video = videoRef.current
      const faceLandmarker = faceLandmarkerRef.current
      const handLandmarker = handLandmarkerRef.current

      if (!video || !faceLandmarker || !handLandmarker) {
        return
      }

      const detectFrame = () => {
        const timestamp = performance.now()
        const faceResult = faceLandmarker.detectForVideo(video, timestamp)
        const handResult = handLandmarker.detectForVideo(video, timestamp)
        latestFaceLandmarksRef.current = faceResult.faceLandmarks[0] ?? null
        latestHandLandmarksRef.current =
          handResult.landmarks.length > 0 ? handResult.landmarks : []
        animationFrameId = requestAnimationFrame(detectFrame)
      }

      detectFrame()
    }

    async function startWebcam() {
      try {
        setStatus('Loading face detection models…')
        const landmarkers = await initializeMediaPipeLandmarkers()
        faceLandmarkerRef.current = landmarkers.faceLandmarker
        handLandmarkerRef.current = landmarkers.handLandmarker

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

        const message = error instanceof Error ? error.message : 'Unknown startup error'

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
      if (cleanupVideo && cleanupVideo.srcObject === stream) {
        cleanupVideo.srcObject = null
      }
      faceLandmarkerRef.current?.close()
      handLandmarkerRef.current?.close()
      faceLandmarkerRef.current = null
      handLandmarkerRef.current = null
    }
  }, [enabled, updateDebugMetrics])

  async function recalibrate() {
    if (!enabled) {
      setStatus('Inactive')
      return
    }

    if (latestFaceLandmarksRef.current === null) {
      setStatus('No face detected — position yourself in frame and try again')
      return
    }

    setStatus('')
    await ensureAlertAudioContext()
    startCalibrationRef.current?.()
  }

  return {
    videoRef,
    canvasRef,
    status,
    calibrationSecondsLeft,
    triggerMessage,
    debugMetrics,
    recalibrate,
  }
}
