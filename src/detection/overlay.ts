import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import type { DetectionPhase, LipStripRect } from './types'

type DrawOverlayOptions = {
  canvas: HTMLCanvasElement
  video: HTMLVideoElement
  faceLandmarks: NormalizedLandmark[]
  mouthRect: LipStripRect | null
  phase: DetectionPhase
  confidence: number | null
}

export function drawDetectionOverlay({ canvas, video }: DrawOverlayOptions) {
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
}
