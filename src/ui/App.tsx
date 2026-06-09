import {
  FaceLandmarker,
  FilesetResolver,
  HandLandmarker,
  type FaceLandmarkerResult,
  type HandLandmarkerResult,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision'
import { useEffect, useRef, useState } from 'react'
import './App.css'

const WASM_FILES_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
const FACE_LANDMARKER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
const HAND_LANDMARKER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
const FINGERTIP_LANDMARK_INDICES = [4, 8, 12, 16, 20]
const LIP_STRIP_COUNT = 3
const CHEWING_HUE_DELTA_THRESHOLD = 5
const CHEWING_SATURATION_DELTA_THRESHOLD = 0.15
const CHEWING_SUSTAINED_THRESHOLD_MS = 4000
const CHEWING_COOLDOWN_MS = 60000

type HsvAverage = {
  hueAverage: number
  saturationAverage: number
}

let latestFaceLandmarks: NormalizedLandmark[] | null = null
let latestHandLandmarks: NormalizedLandmark[][] | null = null
let lipStripCalibrationAverages: Array<HsvAverage | null> = Array.from(
  { length: LIP_STRIP_COUNT },
  () => null,
)
let sustainedCounterMs = 0
let chewingCooldownUntil = 0
let isCalibrationComplete = false

function rgbaToHsv(red: number, green: number, blue: number) {
  const normalizedRed = red / 255
  const normalizedGreen = green / 255
  const normalizedBlue = blue / 255
  const max = Math.max(normalizedRed, normalizedGreen, normalizedBlue)
  const min = Math.min(normalizedRed, normalizedGreen, normalizedBlue)
  const delta = max - min
  let hue = 0

  if (delta !== 0) {
    if (max === normalizedRed) {
      hue = 60 * (((normalizedGreen - normalizedBlue) / delta) % 6)
    } else if (max === normalizedGreen) {
      hue = 60 * ((normalizedBlue - normalizedRed) / delta + 2)
    } else {
      hue = 60 * ((normalizedRed - normalizedGreen) / delta + 4)
    }
  }

  if (hue < 0) {
    hue += 360
  }

  return {
    hue,
    saturation: max === 0 ? 0 : delta / max,
    value: max,
  }
}

function averageHue(firstHue: number, secondHue: number) {
  const firstRadians = (firstHue * Math.PI) / 180
  const secondRadians = (secondHue * Math.PI) / 180
  const x = Math.cos(firstRadians) + Math.cos(secondRadians)
  const y = Math.sin(firstRadians) + Math.sin(secondRadians)
  const average = (Math.atan2(y, x) * 180) / Math.PI

  return average < 0 ? average + 360 : average
}

function getHueDelta(firstHue: number, secondHue: number) {
  const rawDelta = Math.abs(firstHue - secondHue)

  return Math.min(rawDelta, 360 - rawDelta)
}

function updateCalibrationAverages(frameAverages: HsvAverage[]) {
  lipStripCalibrationAverages = frameAverages.map((frameAverage, index) => {
    const calibrationAverage = lipStripCalibrationAverages[index]

    if (calibrationAverage === null) {
      return frameAverage
    }

    return {
      hueAverage: averageHue(calibrationAverage.hueAverage, frameAverage.hueAverage),
      saturationAverage:
        (calibrationAverage.saturationAverage + frameAverage.saturationAverage) / 2,
    }
  })
}

function onFaceResult(result: FaceLandmarkerResult) {
  latestFaceLandmarks = result.faceLandmarks[0] ?? null
}

function onHandResult(result: HandLandmarkerResult) {
  latestHandLandmarks = result.landmarks.length > 0 ? result.landmarks : null
}

function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const calibrationCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null)
  const handLandmarkerRef = useRef<HandLandmarker | null>(null)
  const [status, setStatus] = useState('')
  const [calibrationSecondsLeft, setCalibrationSecondsLeft] = useState<number | null>(null)

  useEffect(() => {
    let stream: MediaStream | undefined
    let animationFrameId: number | undefined
    let calibrationIntervalId: number | undefined
    let calibrationTimeoutId: number | undefined
    let calibrationCountdownIntervalId: number | undefined
    const drawIntervalId = window.setInterval(() => {
      const canvas = canvasRef.current
      const video = videoRef.current

      if (latestFaceLandmarks === null || canvas === null || video === null) {
        return
      }

      const videoWidth = video.videoWidth || canvas.clientWidth
      const videoHeight = video.videoHeight || canvas.clientHeight

      if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
        canvas.width = videoWidth
        canvas.height = videoHeight
      }

      const upperMouthLandmark = latestFaceLandmarks[13]
      const lowerMouthLandmark = latestFaceLandmarks[14]

      if (upperMouthLandmark && lowerMouthLandmark) {
        const upperMouthX = upperMouthLandmark.x * canvas.width
        const upperMouthY = upperMouthLandmark.y * canvas.height
        const lowerMouthX = lowerMouthLandmark.x * canvas.width
        const lowerMouthY = lowerMouthLandmark.y * canvas.height
        const mouthDistance = Math.hypot(
          lowerMouthX - upperMouthX,
          lowerMouthY - upperMouthY,
        )

        console.log('mouth distance', mouthDistance)
      }

      const context = canvas.getContext('2d')

      if (!context) {
        return
      }

      context.clearRect(0, 0, canvas.width, canvas.height)

      const mouthCenter = latestFaceLandmarks[13]

      if (!mouthCenter) {
        return
      }

      const mouthX = mouthCenter.x * canvas.width
      const mouthY = mouthCenter.y * canvas.height

      context.beginPath()
      context.arc(mouthX, mouthY, 5, 0, Math.PI * 2)
      context.fill()

      if (latestHandLandmarks !== null) {
        for (const hand of latestHandLandmarks) {
          for (const fingertipIndex of FINGERTIP_LANDMARK_INDICES) {
            const fingertip = hand[fingertipIndex]

            if (!fingertip) {
              continue
            }

            const fingertipX = fingertip.x * canvas.width
            const fingertipY = fingertip.y * canvas.height

            context.beginPath()
            context.arc(fingertipX, fingertipY, 5, 0, Math.PI * 2)
            context.fill()
          }
        }
      }

      if (!isCalibrationComplete) {
        return
      }

      if (Date.now() < chewingCooldownUntil) {
        // console.log('Chewing detection cooldown active', {
        //   cooldownMsRemaining: chewingCooldownUntil - Date.now(),
        // })
        return
      }

      const lipStripAverages = getLipStripHsvAverages()

      if (!lipStripAverages) {
        sustainedCounterMs = 0
        return
      }

      const stripDeltas = lipStripAverages.map((lipStripAverage, index) => {
        const calibrationAverage = lipStripCalibrationAverages[index]

        if (calibrationAverage === null) {
          return null
        }

        const hueDelta = getHueDelta(
          lipStripAverage.hueAverage,
          calibrationAverage.hueAverage,
        )
        const saturationDelta = Math.abs(
          lipStripAverage.saturationAverage - calibrationAverage.saturationAverage,
        )

        return {
          hueDelta,
          saturationDelta,
          isChewingCandidate:
            hueDelta > CHEWING_HUE_DELTA_THRESHOLD &&
            saturationDelta > CHEWING_SATURATION_DELTA_THRESHOLD,
          stripIndex: index,
        }
      })
      const isChewingCandidate = stripDeltas.some(
        (stripDelta) => stripDelta?.isChewingCandidate,
      )

      // console.log('Chewing detection debug', {
      //   stripDeltas,
      //   sustainedCounterMs,
      //   isChewingCandidate,
      // })

      if (isChewingCandidate) {
        sustainedCounterMs += 250

        if (sustainedCounterMs >= CHEWING_SUSTAINED_THRESHOLD_MS) {
          console.log('chewing detected')
          sustainedCounterMs = 0
          chewingCooldownUntil = Date.now() + CHEWING_COOLDOWN_MS
        }
      } else {
        sustainedCounterMs = 0
      }
    }, 250)
    let isCancelled = false

    function getHsvAverageFromPixelData(data: Uint8ClampedArray): HsvAverage | null {
      let hueXTotal = 0
      let hueYTotal = 0
      let saturationTotal = 0
      let pixelCount = 0

      for (let index = 0; index < data.length; index += 4) {
        const { hue, saturation } = rgbaToHsv(data[index], data[index + 1], data[index + 2])
        const hueRadians = (hue * Math.PI) / 180

        hueXTotal += Math.cos(hueRadians)
        hueYTotal += Math.sin(hueRadians)
        saturationTotal += saturation
        pixelCount += 1
      }

      if (pixelCount === 0) {
        return null
      }

      return {
        hueAverage:
          ((Math.atan2(hueYTotal / pixelCount, hueXTotal / pixelCount) * 180) /
            Math.PI +
            360) %
          360,
        saturationAverage: saturationTotal / pixelCount,
      }
    }

    function getLipStripHsvAverages() {
      const video = videoRef.current
      const faceLandmarks = latestFaceLandmarks

      if (!video || !faceLandmarks) {
        return null
      }

      const upperLip = faceLandmarks[13]
      const lowerLip = faceLandmarks[14]
      const leftLip = faceLandmarks[61]
      const rightLip = faceLandmarks[291]
      const videoWidth = video.videoWidth
      const videoHeight = video.videoHeight

      if (
        !upperLip ||
        !lowerLip ||
        !leftLip ||
        !rightLip ||
        videoWidth === 0 ||
        videoHeight === 0
      ) {
        return null
      }

      const calibrationCanvas =
        calibrationCanvasRef.current ?? document.createElement('canvas')
      calibrationCanvasRef.current = calibrationCanvas
      calibrationCanvas.width = videoWidth
      calibrationCanvas.height = videoHeight

      const calibrationContext = calibrationCanvas.getContext('2d', {
        willReadFrequently: true,
      })

      if (!calibrationContext) {
        return null
      }

      calibrationContext.drawImage(video, 0, 0, videoWidth, videoHeight)

      const upperLipY = upperLip.y * videoHeight
      const lowerLipY = lowerLip.y * videoHeight
      const leftLipX = leftLip.x * videoWidth
      const rightLipX = rightLip.x * videoWidth
      const stripX = Math.max(0, Math.floor(Math.min(leftLipX, rightLipX)))
      const stripY = Math.max(0, Math.floor(Math.min(upperLipY, lowerLipY)))
      const stripRight = Math.min(videoWidth, Math.ceil(Math.max(leftLipX, rightLipX)))
      const stripBottom = Math.min(videoHeight, Math.ceil(Math.max(upperLipY, lowerLipY)))
      const boundedStripWidth = stripRight - stripX
      const boundedStripHeight = stripBottom - stripY

      if (boundedStripWidth <= 0 || boundedStripHeight <= 0) {
        return null
      }

      const stripAverages: HsvAverage[] = []

      for (let stripIndex = 0; stripIndex < LIP_STRIP_COUNT; stripIndex += 1) {
        const regionX = Math.floor(
          stripX + (boundedStripWidth * stripIndex) / LIP_STRIP_COUNT,
        )
        const regionRight =
          stripIndex === LIP_STRIP_COUNT - 1
            ? stripRight
            : Math.floor(stripX + (boundedStripWidth * (stripIndex + 1)) / LIP_STRIP_COUNT)
        const regionWidth = regionRight - regionX

        if (regionWidth <= 0) {
          return null
        }

        const { data } = calibrationContext.getImageData(
          regionX,
          stripY,
          regionWidth,
          boundedStripHeight,
        )
        const stripAverage = getHsvAverageFromPixelData(data)

        if (!stripAverage) {
          return null
        }

        stripAverages.push(stripAverage)
      }

      return stripAverages
    }

    function sampleLipStrip() {
      const lipStripAverages = getLipStripHsvAverages()

      if (!lipStripAverages) {
        return
      }

      updateCalibrationAverages(lipStripAverages)
    }

    function startCalibration() {
      lipStripCalibrationAverages = Array.from({ length: LIP_STRIP_COUNT }, () => null)
      sustainedCounterMs = 0
      chewingCooldownUntil = 0
      isCalibrationComplete = false
      setCalibrationSecondsLeft(3)
      sampleLipStrip()

      calibrationIntervalId = window.setInterval(sampleLipStrip, 250)
      calibrationCountdownIntervalId = window.setInterval(() => {
        setCalibrationSecondsLeft((secondsLeft) =>
          secondsLeft === null ? null : Math.max(1, secondsLeft - 1),
        )
      }, 1000)
      calibrationTimeoutId = window.setTimeout(() => {
        if (calibrationIntervalId !== undefined) {
          clearInterval(calibrationIntervalId)
        }

        if (calibrationCountdownIntervalId !== undefined) {
          clearInterval(calibrationCountdownIntervalId)
        }

        setCalibrationSecondsLeft(null)
        isCalibrationComplete = lipStripCalibrationAverages.every(
          (calibrationAverage) => calibrationAverage !== null,
        )
        // console.log('Calibration complete', { lipStripCalibrationAverages })
      }, 3000)
    }

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

      const handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: HAND_LANDMARKER_MODEL_URL,
        },
        runningMode: 'VIDEO',
        numHands: 2,
      })

      //create from options returns a face and hand landmarker instance with the detectfromvideo method,

      faceLandmarkerRef.current = faceLandmarker
      handLandmarkerRef.current = handLandmarker
    }

    async function startWebcam() {
      try {
        await initializeMediaPipe()

        if (isCancelled) {
          return
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        })

        if (!videoRef.current) {
          return
        }

        videoRef.current.srcObject = stream
        await videoRef.current.play()
        startDetectionLoop()
        startCalibration()
      } catch {
        setStatus('Camera access required')
      }
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

        onFaceResult(faceLandmarker.detectForVideo(video, timestamp))
        onHandResult(handLandmarker.detectForVideo(video, timestamp))

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

      if (calibrationIntervalId !== undefined) {
        clearInterval(calibrationIntervalId)
      }

      if (calibrationTimeoutId !== undefined) {
        clearTimeout(calibrationTimeoutId)
      }

      if (calibrationCountdownIntervalId !== undefined) {
        clearInterval(calibrationCountdownIntervalId)
      }

      clearInterval(drawIntervalId)
      stream?.getTracks().forEach((track) => track.stop())
      faceLandmarkerRef.current?.close()
      handLandmarkerRef.current?.close()
    }
  }, [])

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
              Calibrating, please keep mouth closed
            </div>
          </div>
        )}
      </div>
      <div className="status min-h-6 text-sm text-red-300">{status}</div>
    </main>
  )
}

export default App
