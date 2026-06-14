import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { FACE_BOUNDS_PADDING_SCALE, MIN_STRIP_HEIGHT_PX } from './constants'
import type { LipStripRect } from './types'

export function getMouthDistance(
  landmarks: NormalizedLandmark[],
  videoWidth: number,
  videoHeight: number,
) {
  const upperLip = landmarks[13]
  const lowerLip = landmarks[14]

  if (!upperLip || !lowerLip) {
    return null
  }

  return Math.hypot(
    (lowerLip.x - upperLip.x) * videoWidth,
    (lowerLip.y - upperLip.y) * videoHeight,
  )
}

export function getLipStripRect(
  landmarks: NormalizedLandmark[],
  videoWidth: number,
  videoHeight: number,
): LipStripRect | null {
  const upperLip = landmarks[13]
  const lowerLip = landmarks[14]
  const leftLip = landmarks[61]
  const rightLip = landmarks[291]

  if (!upperLip || !lowerLip || !leftLip || !rightLip) {
    return null
  }

  const leftX = leftLip.x * videoWidth
  const rightX = rightLip.x * videoWidth
  const upperY = upperLip.y * videoHeight
  const lowerY = lowerLip.y * videoHeight
  const lipGap = Math.hypot(
    (lowerLip.x - upperLip.x) * videoWidth,
    (lowerLip.y - upperLip.y) * videoHeight,
  )
  const midY = (upperY + lowerY) / 2
  const stripHeight = Math.max(MIN_STRIP_HEIGHT_PX, lipGap)
  const halfHeight = stripHeight / 2
  const x = Math.max(0, Math.floor(Math.min(leftX, rightX)))
  const right = Math.min(videoWidth, Math.ceil(Math.max(leftX, rightX)))
  const y = Math.max(0, Math.floor(midY - halfHeight))
  const bottom = Math.min(videoHeight, Math.ceil(midY + halfHeight))
  const width = right - x
  const height = bottom - y

  if (width <= 0 || height <= 0) {
    return null
  }

  return { x, y, width, height }
}

export function getMouthCenter(
  faceLandmarks: NormalizedLandmark[],
  videoWidth: number,
  videoHeight: number,
) {
  const upperLip = faceLandmarks[13]
  const lowerLip = faceLandmarks[14]

  if (!upperLip || !lowerLip) {
    return null
  }

  return {
    x: ((upperLip.x + lowerLip.x) / 2) * videoWidth,
    y: ((upperLip.y + lowerLip.y) / 2) * videoHeight,
  }
}

export function getFaceBounds(
  faceLandmarks: NormalizedLandmark[],
  videoWidth: number,
  videoHeight: number,
) {
  let minX = 1
  let minY = 1
  let maxX = 0
  let maxY = 0

  faceLandmarks.forEach((landmark) => {
    minX = Math.min(minX, landmark.x)
    minY = Math.min(minY, landmark.y)
    maxX = Math.max(maxX, landmark.x)
    maxY = Math.max(maxY, landmark.y)
  })

  const boundsWidth = (maxX - minX) * videoWidth
  const boundsHeight = (maxY - minY) * videoHeight
  const paddingX = boundsWidth * FACE_BOUNDS_PADDING_SCALE
  const paddingY = boundsHeight * FACE_BOUNDS_PADDING_SCALE

  return {
    left: minX * videoWidth - paddingX,
    right: maxX * videoWidth + paddingX,
    top: minY * videoHeight - paddingY,
    bottom: maxY * videoHeight + paddingY,
    width: boundsWidth,
  }
}
