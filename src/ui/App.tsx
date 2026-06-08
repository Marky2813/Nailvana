import {
  FaceLandmarker,
  FilesetResolver,
  HandLandmarker,
  type FaceLandmarkerResult,
  type HandLandmarkerResult,
} from '@mediapipe/tasks-vision'
import { useEffect, useRef, useState } from 'react'
import './App.css'

const WASM_FILES_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
const FACE_LANDMARKER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
const HAND_LANDMARKER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

function onFaceResult(_result: FaceLandmarkerResult) {
  void _result
  // TODO: Handle face result.
}

function onHandResult(_result: HandLandmarkerResult) {
  void _result
  // TODO: Handle hand result.
}

function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null)
  const handLandmarkerRef = useRef<HandLandmarker | null>(null)
  const [status, setStatus] = useState('')

  useEffect(() => {
    let stream: MediaStream | undefined
    let animationFrameId: number | undefined
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

      stream?.getTracks().forEach((track) => track.stop())
      faceLandmarkerRef.current?.close()
      handLandmarkerRef.current?.close()
    }
  }, [])

  return (
    <>
      <div>CatchChew</div>
      <canvas id='canvas'></canvas>
      <video ref={videoRef} className='webcam' autoPlay muted></video>
      <div className="status">{status}</div>
    </>
  )
}

export default App
