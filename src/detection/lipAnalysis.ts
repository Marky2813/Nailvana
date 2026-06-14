import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { averageSaturationFromPixelData } from './color'
import { LIP_REGION_COUNT, REGION_LABELS, SATURATION_THRESHOLD, UNIFORM_SATURATION_SPREAD_MAX } from './constants'
import { getLipStripRect, getMouthDistance } from './lipGeometry'
import type { LipSample, LipSampleWithRect, LipStripRect } from './types'

export function sampleRegionSaturations(
  sampleContext: CanvasRenderingContext2D,
  stripRect: LipStripRect,
) {
  const regionSaturations: number[] = []

  for (let regionIndex = 0; regionIndex < LIP_REGION_COUNT; regionIndex += 1) {
    const regionX = Math.floor(
      stripRect.x + (stripRect.width * regionIndex) / LIP_REGION_COUNT,
    )
    const regionRight =
      regionIndex === LIP_REGION_COUNT - 1
        ? stripRect.x + stripRect.width
        : Math.floor(stripRect.x + (stripRect.width * (regionIndex + 1)) / LIP_REGION_COUNT)
    const regionWidth = regionRight - regionX

    if (regionWidth <= 0) {
      return null
    }

    const { data } = sampleContext.getImageData(
      regionX,
      stripRect.y,
      regionWidth,
      stripRect.height,
    )
    const saturation = averageSaturationFromPixelData(data)

    if (saturation === null) {
      return null
    }

    regionSaturations.push(saturation)
  }

  return regionSaturations
}

export function getMaxSaturationDelta(regionSaturations: number[], baselineSaturations: number[]) {
  let maxDelta = 0
  let activeRegionIndex = 0

  regionSaturations.forEach((saturation, index) => {
    const delta = Math.abs(saturation - baselineSaturations[index])
    if (delta > maxDelta) {
      maxDelta = delta
      activeRegionIndex = index
    }
  })

  return {
    maxDelta,
    activeRegion: REGION_LABELS[activeRegionIndex] ?? null,
  }
}

export function averageRegionSaturations(samples: LipSample[]) {
  if (samples.length === 0) {
    return null
  }

  const regionTotals = Array.from({ length: LIP_REGION_COUNT }, () => 0)

  samples.forEach((sample) => {
    sample.regionSaturations.forEach((saturation, index) => {
      regionTotals[index] += saturation
    })
  })

  return regionTotals.map((total) => total / samples.length)
}

export function isUniformSaturationShift(
  regionSaturations: number[],
  baselineSaturations: number[],
) {
  const deltas = regionSaturations.map((saturation, index) =>
    Math.abs(saturation - baselineSaturations[index]),
  )
  const maxDelta = Math.max(...deltas)
  const minDelta = Math.min(...deltas)

  return maxDelta > SATURATION_THRESHOLD && maxDelta - minDelta < UNIFORM_SATURATION_SPREAD_MAX
}

export function averageSaturation(regionSaturations: number[]) {
  return (
    regionSaturations.reduce((total, value) => total + value, 0) / regionSaturations.length
  )
}

export function sampleLipFromVideo(
  video: HTMLVideoElement,
  faceLandmarks: NormalizedLandmark[],
  sampleCanvas: HTMLCanvasElement | null,
): (LipSampleWithRect & { sampleCanvas: HTMLCanvasElement }) | null {
  const videoWidth = video.videoWidth
  const videoHeight = video.videoHeight

  if (videoWidth === 0 || videoHeight === 0) {
    return null
  }

  const stripRect = getLipStripRect(faceLandmarks, videoWidth, videoHeight)
  const mouthDistance = getMouthDistance(faceLandmarks, videoWidth, videoHeight)

  if (!stripRect || mouthDistance === null) {
    return null
  }

  const canvas = sampleCanvas ?? document.createElement('canvas')
  canvas.width = videoWidth
  canvas.height = videoHeight

  const sampleContext = canvas.getContext('2d', { willReadFrequently: true })

  if (!sampleContext) {
    return null
  }

  sampleContext.drawImage(video, 0, 0, videoWidth, videoHeight)

  const regionSaturations = sampleRegionSaturations(sampleContext, stripRect)

  if (!regionSaturations) {
    return null
  }

  return {
    sampleCanvas: canvas,
    regionSaturations,
    stripRect,
    mouthDistance,
  }
}
