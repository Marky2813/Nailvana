import type { RefObject } from 'react'

type CameraViewProps = {
  videoRef: RefObject<HTMLVideoElement | null>
  canvasRef: RefObject<HTMLCanvasElement | null>
  triggerMessage: string | null
}

export function CameraView({ videoRef, canvasRef, triggerMessage }: CameraViewProps) {
  return (
    <div className="webcam-panel">
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
      {triggerMessage !== null && (
        <div className="stop-biting-popup">
          <div>Stop biting</div>
        </div>
      )}
    </div>
  )
}
