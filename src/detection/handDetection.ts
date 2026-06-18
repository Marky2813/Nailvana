import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import {
  FINGERTIP_LANDMARK_INDICES,
  HAND_NEAR_MOUTH_RADIUS_SCALE,
  HAND_TRACKING_LANDMARK_INDICES,
  HEAD_TOUCH_MARGIN_PX,
  MIN_HAND_NEAR_MOUTH_RADIUS_PX,
} from './constants'
import { getFaceBounds, getMouthCenter } from './lipGeometry'

export function isHandNearMouth(
  handLandmarks: NormalizedLandmark[][],
  faceLandmarks: NormalizedLandmark[],
  videoWidth: number,
  videoHeight: number,
) {
  const mouthCenter = getMouthCenter(faceLandmarks, videoWidth, videoHeight)

  if (!mouthCenter || handLandmarks.length === 0) {
    return false
  }

  const faceBounds = getFaceBounds(faceLandmarks, videoWidth, videoHeight)
  const radius = Math.max(
    MIN_HAND_NEAR_MOUTH_RADIUS_PX,
    faceBounds.width * HAND_NEAR_MOUTH_RADIUS_SCALE,
  )

  return handLandmarks.some((hand) =>
    FINGERTIP_LANDMARK_INDICES.some((landmarkIndex) => {
      const point = hand[landmarkIndex]

      if (!point) {
        return false
      }

      return (
        Math.hypot(point.x * videoWidth - mouthCenter.x, point.y * videoHeight - mouthCenter.y) <
        radius
      )
    }),
  )
}
export function isHandTouchingHead(
  handLandmarks: NormalizedLandmark[][],
  faceLandmarks: NormalizedLandmark[],
  videoWidth: number,
  videoHeight: number,
) {
  if (
    handLandmarks.length === 0 ||
    isHandNearMouth(handLandmarks, faceLandmarks, videoWidth, videoHeight)
  ) {
    return false
  }

  const mouthCenter = getMouthCenter(faceLandmarks, videoWidth, videoHeight)

  if (!mouthCenter) {
    return false
  }

  const faceBounds = getFaceBounds(faceLandmarks, videoWidth, videoHeight)
  const headZoneBottom = mouthCenter.y - HEAD_TOUCH_MARGIN_PX

  return handLandmarks.some((hand) =>
    HAND_TRACKING_LANDMARK_INDICES.some((landmarkIndex) => {
      const point = hand[landmarkIndex]

      if (!point) {
        return false
      }

      const x = point.x * videoWidth
      const y = point.y * videoHeight

      return (
        x >= faceBounds.left &&
        x <= faceBounds.right &&
        y >= faceBounds.top &&
        y <= headZoneBottom
      )
    }),
  )
}

