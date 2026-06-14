import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { CONTACT_SCORE_THRESHOLD } from './constants'
import type { DetectionPhase, LipStripRect } from './types'

type DrawOverlayOptions = {
  canvas: HTMLCanvasElement
  video: HTMLVideoElement
  faceLandmarks: NormalizedLandmark[]
  mouthRect: LipStripRect | null
  phase: DetectionPhase
  confidence: number | null
}

export function drawDetectionOverlay({
  canvas,
  video,
  faceLandmarks,
  mouthRect,
  phase,
  confidence,
}: DrawOverlayOptions) {
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

  if (!mouthRect) {
    return
  }

  const isCandidate = confidence !== null && confidence > CONTACT_SCORE_THRESHOLD

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
  context.strokeRect(mouthRect.x, mouthRect.y, mouthRect.width, mouthRect.height)

  context.fillStyle = 'rgba(0, 0, 0, 0.45)'
  context.fillRect(mouthRect.x, Math.max(0, mouthRect.y - 18), 78, 18)
  context.fillStyle = 'rgba(255, 255, 255, 0.9)'
  context.font = '12px ui-monospace, Consolas, monospace'
  context.fillText(
    confidence === null ? 'calib' : `conf ${confidence.toFixed(2)}`,
    mouthRect.x + 5,
    Math.max(12, mouthRect.y - 5),
  )
}
