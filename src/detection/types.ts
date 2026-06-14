export type LipStripRect = {
  x: number
  y: number
  width: number
  height: number
}

export type LipSample = {
  regionSaturations: number[]
  mouthDistance: number
}

export type LipSampleWithRect = LipSample & { stripRect: LipStripRect }

export type DetectionPhase = 'initializing' | 'calibrating' | 'monitoring' | 'triggered'

export type DetectionReason = 'contact' | 'motion' | 'hand'

export type TrackingQuality = {
  valid: boolean
  reason: string | null
}

export type DebugMetrics = {
  phase: DetectionPhase
  trackingValid: boolean
  trackingIssue: string | null
  contactScore: number | null
  objectScore: number | null
  motionScore: number | null
  handScore: number | null
  finalConfidence: number | null
  mouthDistance: number | null
  mouthOpenRatio: number | null
  baselineMouthDistance: number | null
  contactSamples: number
  motionSamples: number
  handNearMouthSamples: number
  calibrationSampleCount: number
  handNearMouth: boolean
  mouthCropBrightness: number | null
  mouthCropContrast: number | null
  mouthCropChange: number | null
  mouthCropEdgeChange: number | null
  mouthCenterBandChange: number | null
  mouthCenterPeakChange: number | null
}

export const INITIAL_DEBUG_METRICS: DebugMetrics = {
  phase: 'initializing',
  trackingValid: false,
  trackingIssue: null,
  contactScore: null,
  objectScore: null,
  motionScore: null,
  handScore: null,
  finalConfidence: null,
  mouthDistance: null,
  mouthOpenRatio: null,
  baselineMouthDistance: null,
  contactSamples: 0,
  motionSamples: 0,
  handNearMouthSamples: 0,
  calibrationSampleCount: 0,
  handNearMouth: false,
  mouthCropBrightness: null,
  mouthCropContrast: null,
  mouthCropChange: null,
  mouthCropEdgeChange: null,
  mouthCenterBandChange: null,
  mouthCenterPeakChange: null,
}

export function formatMetric(value: number | null, digits = 3) {
  return value === null ? '-' : value.toFixed(digits)
}
