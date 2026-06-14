import type { RefObject } from 'react'

type CameraViewProps = {
  videoRef: RefObject<HTMLVideoElement | null>
  canvasRef: RefObject<HTMLCanvasElement | null>
  calibrationSecondsLeft: number | null
  triggerMessage: string | null
}

export function CameraView({
  videoRef,
  canvasRef,
  calibrationSecondsLeft,
  triggerMessage,
}: CameraViewProps) {
  return (
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
          <div className="text-5xl font-semibold tabular-nums">{calibrationSecondsLeft}</div>
          <div className="mt-3 text-lg font-medium">Calibrating - keep your mouth clear</div>
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
  )
}
