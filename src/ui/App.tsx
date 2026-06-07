import { useEffect, useRef, useState } from 'react'
import './App.css'

function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState('')

  useEffect(() => {
    let stream: MediaStream | undefined

    async function startWebcam() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        })

        if (!videoRef.current) {
          return
        }

        videoRef.current.srcObject = stream
        await videoRef.current.play()
      } catch {
        setStatus('Camera access required')
      }
    }

    startWebcam()

    return () => {
      stream?.getTracks().forEach((track) => track.stop())
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
