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

let latestFaceLandmarks: NormalizedLandmark[] | null = null
let latestHandLandmarks: NormalizedLandmark[][] | null = null

function onFaceResult(result: FaceLandmarkerResult) {
  latestFaceLandmarks = result.faceLandmarks[0] ?? null
}

function onHandResult(result: HandLandmarkerResult) {
  latestHandLandmarks = result.landmarks.length > 0 ? result.landmarks : null
}

function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null)
  const handLandmarkerRef = useRef<HandLandmarker | null>(null)
  const [status, setStatus] = useState('')

  useEffect(() => {
    let stream: MediaStream | undefined
    let animationFrameId: number | undefined
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
    }, 500)
    let isCancelled = false

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
      </div>
      <div className="status min-h-6 text-sm text-red-300">{status}</div>
    </main>
  )
}

export default App
