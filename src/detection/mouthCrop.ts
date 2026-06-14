import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import {
  FACE_CENTER_MARGIN_RATIO,
  MAX_FACE_WIDTH_RATIO,
  MIN_FACE_WIDTH_RATIO,
  MOUTH_CROP_BASELINE_ALPHA,
  MOUTH_CROP_EDGE_MARGIN_PX,
  MOUTH_CROP_HEIGHT,
  MOUTH_CROP_WIDTH,
} from './constants'
import { getFaceBounds, getMouthDistance } from './lipGeometry'
import type { LipStripRect, TrackingQuality } from './types'

export type MouthCropSample = {
  rect: LipStripRect
  luma: number[]
  brightness: number
  contrast: number
  edgeMean: number
  mouthDistance: number
}

export type MouthCropBaseline = {
  luma: number[]
  brightness: number
  contrast: number
  edgeMean: number
  mouthDistance: number
}

export type MouthCropScores = {
  contactScore: number
  objectScore: number
  motionScore: number
  cropChange: number
  edgeChange: number
  centerBandChange: number
  centerPeakChange: number
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

function scoreRange(value: number, low: number, high: number) {
  return clamp01((value - low) / (high - low))
}

function getCenterBandChange(sample: MouthCropSample, baseline: MouthCropBaseline) {
  const diffs: number[] = []
  const startX = Math.floor(MOUTH_CROP_WIDTH * 0.12)
  const endX = Math.ceil(MOUTH_CROP_WIDTH * 0.88)
  const startY = Math.floor(MOUTH_CROP_HEIGHT * 0.32)
  const endY = Math.ceil(MOUTH_CROP_HEIGHT * 0.72)

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const index = y * MOUTH_CROP_WIDTH + x
      const normalizedCurrent = sample.luma[index] - sample.brightness
      const normalizedBaseline = baseline.luma[index] - baseline.brightness

      diffs.push(Math.abs(normalizedCurrent - normalizedBaseline))
    }
  }

  if (diffs.length === 0) {
    return { centerBandChange: 0, centerPeakChange: 0 }
  }

  diffs.sort((left, right) => right - left)

  const topCount = Math.max(1, Math.floor(diffs.length * 0.12))
  const centerPeakChange =
    diffs.slice(0, topCount).reduce((total, value) => total + value, 0) / topCount
  const centerBandChange = diffs.reduce((total, value) => total + value, 0) / diffs.length

  return { centerBandChange, centerPeakChange }
}

function getLandmarkPoint(
  landmarks: NormalizedLandmark[],
  index: number,
  videoWidth: number,
  videoHeight: number,
) {
  const point = landmarks[index]

  if (!point) {
    return null
  }

  return {
    x: point.x * videoWidth,
    y: point.y * videoHeight,
  }
}

export function getMouthCropRect(
  landmarks: NormalizedLandmark[],
  videoWidth: number,
  videoHeight: number,
): LipStripRect | null {
  const leftLip = getLandmarkPoint(landmarks, 61, videoWidth, videoHeight)
  const rightLip = getLandmarkPoint(landmarks, 291, videoWidth, videoHeight)
  const upperLip = getLandmarkPoint(landmarks, 13, videoWidth, videoHeight)
  const lowerLip = getLandmarkPoint(landmarks, 14, videoWidth, videoHeight)

  if (!leftLip || !rightLip || !upperLip || !lowerLip) {
    return null
  }

  const mouthWidth = Math.hypot(rightLip.x - leftLip.x, rightLip.y - leftLip.y)
  const mouthGap = Math.max(1, Math.hypot(lowerLip.x - upperLip.x, lowerLip.y - upperLip.y))
  const centerX = (leftLip.x + rightLip.x + upperLip.x + lowerLip.x) / 4
  const centerY = (upperLip.y + lowerLip.y) / 2
  const cropWidth = Math.max(48, mouthWidth * 2.35)
  const cropHeight = Math.max(38, mouthGap * 5.2, cropWidth * 0.58)
  const x = Math.floor(centerX - cropWidth / 2)
  const y = Math.floor(centerY - cropHeight / 2)
  const right = Math.ceil(centerX + cropWidth / 2)
  const bottom = Math.ceil(centerY + cropHeight / 2)

  if (right <= 0 || bottom <= 0 || x >= videoWidth || y >= videoHeight) {
    return null
  }

  return {
    x: Math.max(0, x),
    y: Math.max(0, y),
    width: Math.min(videoWidth, right) - Math.max(0, x),
    height: Math.min(videoHeight, bottom) - Math.max(0, y),
  }
}

export function evaluateTrackingQuality(
  landmarks: NormalizedLandmark[],
  videoWidth: number,
  videoHeight: number,
  cropRect: LipStripRect | null,
): TrackingQuality {
  if (!cropRect) {
    return { valid: false, reason: 'mouth crop unavailable' }
  }

  const faceBounds = getFaceBounds(landmarks, videoWidth, videoHeight)
  const faceWidthRatio = faceBounds.width / videoWidth
  const faceCenterX = (faceBounds.left + faceBounds.right) / 2
  const faceCenterY = (faceBounds.top + faceBounds.bottom) / 2
  const xMargin = videoWidth * FACE_CENTER_MARGIN_RATIO
  const yMargin = videoHeight * FACE_CENTER_MARGIN_RATIO

  if (faceWidthRatio < MIN_FACE_WIDTH_RATIO) {
    return { valid: false, reason: 'face too far' }
  }

  if (faceWidthRatio > MAX_FACE_WIDTH_RATIO) {
    return { valid: false, reason: 'face too close' }
  }

  if (
    faceCenterX < xMargin ||
    faceCenterX > videoWidth - xMargin ||
    faceCenterY < yMargin ||
    faceCenterY > videoHeight - yMargin
  ) {
    return { valid: false, reason: 'recenter face' }
  }

  if (
    cropRect.x <= MOUTH_CROP_EDGE_MARGIN_PX ||
    cropRect.y <= MOUTH_CROP_EDGE_MARGIN_PX ||
    cropRect.x + cropRect.width >= videoWidth - MOUTH_CROP_EDGE_MARGIN_PX ||
    cropRect.y + cropRect.height >= videoHeight - MOUTH_CROP_EDGE_MARGIN_PX
  ) {
    return { valid: false, reason: 'mouth near frame edge' }
  }

  return { valid: true, reason: null }
}

function summarizeLuma(luma: number[]) {
  const brightness = luma.reduce((total, value) => total + value, 0) / luma.length
  const variance =
    luma.reduce((total, value) => total + (value - brightness) ** 2, 0) / luma.length
  let edgeTotal = 0
  let edgeCount = 0

  for (let y = 0; y < MOUTH_CROP_HEIGHT; y += 1) {
    for (let x = 0; x < MOUTH_CROP_WIDTH; x += 1) {
      const index = y * MOUTH_CROP_WIDTH + x

      if (x + 1 < MOUTH_CROP_WIDTH) {
        edgeTotal += Math.abs(luma[index] - luma[index + 1])
        edgeCount += 1
      }

      if (y + 1 < MOUTH_CROP_HEIGHT) {
        edgeTotal += Math.abs(luma[index] - luma[index + MOUTH_CROP_WIDTH])
        edgeCount += 1
      }
    }
  }

  return {
    brightness,
    contrast: Math.sqrt(variance),
    edgeMean: edgeCount === 0 ? 0 : edgeTotal / edgeCount,
  }
}

export function sampleMouthCropFromVideo(
  video: HTMLVideoElement,
  faceLandmarks: NormalizedLandmark[],
  sampleCanvas: HTMLCanvasElement | null,
): (MouthCropSample & { sampleCanvas: HTMLCanvasElement; trackingQuality: TrackingQuality }) | null {
  const videoWidth = video.videoWidth
  const videoHeight = video.videoHeight

  if (videoWidth === 0 || videoHeight === 0) {
    return null
  }

  const rect = getMouthCropRect(faceLandmarks, videoWidth, videoHeight)
  const trackingQuality = evaluateTrackingQuality(faceLandmarks, videoWidth, videoHeight, rect)
  const mouthDistance = getMouthDistance(faceLandmarks, videoWidth, videoHeight)

  if (!rect || mouthDistance === null) {
    return null
  }

  const canvas = sampleCanvas ?? document.createElement('canvas')
  canvas.width = MOUTH_CROP_WIDTH
  canvas.height = MOUTH_CROP_HEIGHT

  const context = canvas.getContext('2d', { willReadFrequently: true })

  if (!context) {
    return null
  }

  context.drawImage(
    video,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    0,
    0,
    MOUTH_CROP_WIDTH,
    MOUTH_CROP_HEIGHT,
  )

  const { data } = context.getImageData(0, 0, MOUTH_CROP_WIDTH, MOUTH_CROP_HEIGHT)
  const luma: number[] = []

  for (let index = 0; index < data.length; index += 4) {
    luma.push((0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2]) / 255)
  }

  return {
    sampleCanvas: canvas,
    rect,
    luma,
    mouthDistance,
    trackingQuality,
    ...summarizeLuma(luma),
  }
}

export function finalizeMouthCropBaseline(samples: MouthCropSample[]): MouthCropBaseline | null {
  if (samples.length === 0) {
    return null
  }

  const luma = Array.from({ length: MOUTH_CROP_WIDTH * MOUTH_CROP_HEIGHT }, () => 0)
  let brightness = 0
  let contrast = 0
  let edgeMean = 0
  let mouthDistance = 0

  samples.forEach((sample) => {
    sample.luma.forEach((value, index) => {
      luma[index] += value
    })
    brightness += sample.brightness
    contrast += sample.contrast
    edgeMean += sample.edgeMean
    mouthDistance += sample.mouthDistance
  })

  return {
    luma: luma.map((value) => value / samples.length),
    brightness: brightness / samples.length,
    contrast: contrast / samples.length,
    edgeMean: edgeMean / samples.length,
    mouthDistance: mouthDistance / samples.length,
  }
}

export function updateMouthCropBaseline(
  baseline: MouthCropBaseline,
  sample: MouthCropSample,
): MouthCropBaseline {
  const alpha = MOUTH_CROP_BASELINE_ALPHA

  return {
    luma: baseline.luma.map((value, index) => value * (1 - alpha) + sample.luma[index] * alpha),
    brightness: baseline.brightness * (1 - alpha) + sample.brightness * alpha,
    contrast: baseline.contrast * (1 - alpha) + sample.contrast * alpha,
    edgeMean: baseline.edgeMean * (1 - alpha) + sample.edgeMean * alpha,
    mouthDistance: baseline.mouthDistance * (1 - alpha) + sample.mouthDistance * alpha,
  }
}

export function scoreMouthCrop(
  sample: MouthCropSample,
  baseline: MouthCropBaseline,
  mouthDistanceHistory: number[],
): MouthCropScores {
  const brightnessDelta = sample.brightness - baseline.brightness
  const normalizedDiff =
    sample.luma.reduce((total, value, index) => {
      const normalizedCurrent = value - sample.brightness
      const normalizedBaseline = baseline.luma[index] - baseline.brightness

      return total + Math.abs(normalizedCurrent - normalizedBaseline)
    }, 0) / sample.luma.length
  const edgeChange = Math.abs(sample.edgeMean - baseline.edgeMean)
  const contrastChange = Math.abs(sample.contrast - baseline.contrast)
  const { centerBandChange, centerPeakChange } = getCenterBandChange(sample, baseline)
  const lightingPenalty = scoreRange(Math.abs(brightnessDelta), 0.16, 0.34) * 0.28
  const wholeCropContactScore = clamp01(
    scoreRange(normalizedDiff, 0.055, 0.18) * 0.58 +
      scoreRange(edgeChange, 0.025, 0.105) * 0.27 +
      scoreRange(contrastChange, 0.035, 0.13) * 0.15 -
      lightingPenalty,
  )
  const objectScore = clamp01(
    scoreRange(centerPeakChange, 0.09, 0.24) * 0.58 +
      scoreRange(centerBandChange, 0.045, 0.13) * 0.28 +
      scoreRange(edgeChange, 0.02, 0.08) * 0.14 -
      lightingPenalty * 0.55,
  )
  const contactScore = wholeCropContactScore

  const history = [...mouthDistanceHistory, sample.mouthDistance].slice(-8)
  const minDistance = Math.min(...history)
  const maxDistance = Math.max(...history)
  const baselineDistance = Math.max(1, baseline.mouthDistance)
  const rangeRatio = (maxDistance - minDistance) / baselineDistance
  const distanceDeltaRatio = Math.abs(sample.mouthDistance - baseline.mouthDistance) / baselineDistance
  const motionScore = clamp01(
    scoreRange(rangeRatio, 0.1, 0.34) * 0.7 + scoreRange(distanceDeltaRatio, 0.14, 0.36) * 0.3,
  )

  return {
    contactScore,
    objectScore,
    motionScore,
    cropChange: normalizedDiff,
    edgeChange,
    centerBandChange,
    centerPeakChange,
  }
}
