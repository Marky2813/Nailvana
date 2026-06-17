import type { RefObject } from 'react'
import sleepicon from '../ui/assets/sleep.png'

type CameraViewProps = {
  videoRef: RefObject<HTMLVideoElement | null>
  canvasRef: RefObject<HTMLCanvasElement | null>
  triggerMessage: string | null
  isSleeping: boolean
}


export function CameraView({ videoRef, canvasRef, triggerMessage, isSleeping }: CameraViewProps) {
  const biteDetected = triggerMessage !== null

  return (
    <div className={`webcam-panel${biteDetected ? ' bite-detected' : ''}`}>
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        autoPlay
        muted
      ></video>
      <canvas
        ref={canvasRef}
        id="canvas"
        className="pointer-events-none absolute inset-0 h-full w-full"
      ></canvas>
      {isSleeping && (
        <div className="sleeping-panel">
          {/* <SleepIcon /> */}
          <img src={sleepicon} alt="Sleeping Icon" className="h-5 w-5 mb-2" />  
          <div className="sleeping-title">Nailvana is sleeping</div>
          <div className="sleeping-copy">Camera off. Rest easy.</div>
        </div>
      )}
      {biteDetected && (
        <div className="bite-alert-overlay">
          <div>Stay calm, you've got this!</div>
        </div>
      )}
    </div>
  )
}
