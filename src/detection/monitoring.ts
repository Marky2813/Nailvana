import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import {
  CONTACT_SCORE_THRESHOLD,
  CONSECUTIVE_SAMPLES_REQUIRED,
  HAND_SCORE_THRESHOLD,
  MOUTH_OPEN_BLOCK_DISTANCE_PX,
  MOTION_SCORE_THRESHOLD,
} from './constants'
import { isHandNearMouth } from './handDetection'
import {
  finalizeMouthCropBaseline,
  sampleMouthCropFromVideo,
  scoreMouthCrop,
  updateMouthCropBaseline,
  type MouthCropBaseline,
  type MouthCropSample,
} from './mouthCrop'
import type { DebugMetrics, DetectionReason } from './types'

export type MonitoringState = {
  baseline: MouthCropBaseline | null
  mouthDistanceHistory: number[]
  consecutiveContactSamples: number
  consecutiveMotionSamples: number
  consecutiveHandMouthSamples: number
}

export type MonitoringInput = {
  video: HTMLVideoElement
  faceLandmarks: NormalizedLandmark[]
  handLandmarks: NormalizedLandmark[][]
  sampleCanvas: HTMLCanvasElement | null
  state: MonitoringState
}

export type MonitoringResult =
  | {
      kind: 'missing'
      resetCounters: true
    }
  | {
      kind: 'no-baseline'
    }
  | {
      kind: 'update'
      sample: MouthCropSample
      sampleCanvas: HTMLCanvasElement
      metrics: Partial<DebugMetrics>
      nextState: MonitoringState
      trigger: DetectionReason | null
      triggerDetails: Record<string, unknown>
    }

function getResetState(state: MonitoringState): MonitoringState {
  return {
    ...state,
    mouthDistanceHistory: [],
    consecutiveContactSamples: 0,
    consecutiveMotionSamples: 0,
    consecutiveHandMouthSamples: 0,
  }
}

export function evaluateMonitoringFrame(input: MonitoringInput): MonitoringResult {
  const sampled = sampleMouthCropFromVideo(input.video, input.faceLandmarks, input.sampleCanvas)

  if (!sampled) {
    return { kind: 'missing', resetCounters: true }
  }

  const { sampleCanvas, trackingQuality, ...sample } = sampled

  if (input.state.baseline === null) {
    return { kind: 'no-baseline' }
  }

  const baseline = input.state.baseline
  const mouthOpenRatio = sample.mouthDistance / Math.max(1, baseline.mouthDistance)
  const videoWidth = input.video.videoWidth
  const videoHeight = input.video.videoHeight
  const handNearMouth = isHandNearMouth(
    input.handLandmarks,
    input.faceLandmarks,
    videoWidth,
    videoHeight,
  )
  const handScore = handNearMouth ? 1 : 0

  if (!trackingQuality.valid) {
    const nextState = getResetState(input.state)

    return {
      kind: 'update',
      sample,
      sampleCanvas,
      metrics: {
        phase: 'monitoring',
        trackingValid: false,
        trackingIssue: trackingQuality.reason,
        contactScore: null,
        objectScore: null,
        motionScore: null,
        handScore,
        finalConfidence: null,
        mouthDistance: sample.mouthDistance,
        mouthOpenRatio,
        baselineMouthDistance: baseline.mouthDistance,
        contactSamples: 0,
        motionSamples: 0,
        handNearMouthSamples: 0,
        handNearMouth,
        mouthCropBrightness: sample.brightness,
        mouthCropContrast: sample.contrast,
        mouthCropChange: null,
        mouthCropEdgeChange: null,
        mouthCenterBandChange: null,
        mouthCenterPeakChange: null,
      },
      nextState,
      trigger: null,
      triggerDetails: { trackingIssue: trackingQuality.reason },
    }
  }

  if (sample.mouthDistance >= MOUTH_OPEN_BLOCK_DISTANCE_PX) {
    const nextState = getResetState(input.state)

    return {
      kind: 'update',
      sample,
      sampleCanvas,
      metrics: {
        phase: 'monitoring',
        trackingValid: false,
        trackingIssue: 'mouth too open',
        contactScore: null,
        objectScore: null,
        motionScore: null,
        handScore,
        finalConfidence: null,
        mouthDistance: sample.mouthDistance,
        mouthOpenRatio,
        baselineMouthDistance: baseline.mouthDistance,
        contactSamples: 0,
        motionSamples: 0,
        handNearMouthSamples: 0,
        handNearMouth,
        mouthCropBrightness: sample.brightness,
        mouthCropContrast: sample.contrast,
        mouthCropChange: null,
        mouthCropEdgeChange: null,
        mouthCenterBandChange: null,
        mouthCenterPeakChange: null,
      },
      nextState,
      trigger: null,
      triggerDetails: { trackingIssue: 'mouth too open', mouthOpenRatio },
    }
  }

  const scores = scoreMouthCrop(sample, baseline, input.state.mouthDistanceHistory)
  const contactCandidate = false
  const handCandidate = handScore >= HAND_SCORE_THRESHOLD
  const motionCandidate = false

  const consecutiveContactSamples = contactCandidate
    ? input.state.consecutiveContactSamples + 1
    : 0
  const consecutiveMotionSamples = motionCandidate ? input.state.consecutiveMotionSamples + 1 : 0
  const consecutiveHandMouthSamples = handCandidate
    ? input.state.consecutiveHandMouthSamples + 1
    : 0
  const finalConfidence = Math.max(
    scores.contactScore,
    scores.motionScore * 0.25,
    handScore * 0.9,
  )
  const neutralFrame =
    scores.contactScore < CONTACT_SCORE_THRESHOLD * 0.45 &&
    scores.motionScore < MOTION_SCORE_THRESHOLD * 0.45 &&
    !handCandidate
  const nextBaseline = neutralFrame ? updateMouthCropBaseline(baseline, sample) : baseline
  const nextState: MonitoringState = {
    baseline: nextBaseline,
    mouthDistanceHistory: [...input.state.mouthDistanceHistory, sample.mouthDistance].slice(-8),
    consecutiveContactSamples,
    consecutiveMotionSamples,
    consecutiveHandMouthSamples,
  }

  const metrics: Partial<DebugMetrics> = {
    phase: 'monitoring',
    trackingValid: true,
    trackingIssue: null,
    contactScore: scores.contactScore,
    objectScore: scores.objectScore,
    motionScore: scores.motionScore,
    handScore,
    finalConfidence,
    mouthDistance: sample.mouthDistance,
    mouthOpenRatio,
    baselineMouthDistance: nextBaseline.mouthDistance,
    contactSamples: consecutiveContactSamples,
    motionSamples: consecutiveMotionSamples,
    handNearMouthSamples: consecutiveHandMouthSamples,
    handNearMouth,
    mouthCropBrightness: sample.brightness,
    mouthCropContrast: sample.contrast,
    mouthCropChange: scores.cropChange,
    mouthCropEdgeChange: scores.edgeChange,
    mouthCenterBandChange: scores.centerBandChange,
    mouthCenterPeakChange: scores.centerPeakChange,
  }

  if (consecutiveHandMouthSamples >= CONSECUTIVE_SAMPLES_REQUIRED) {
    return {
      kind: 'update',
      sample,
      sampleCanvas,
      metrics,
      nextState: getResetState(nextState),
      trigger: 'hand',
      triggerDetails: { handScore, finalConfidence },
    }
  }

  return {
    kind: 'update',
    sample,
    sampleCanvas,
    metrics,
    nextState,
    trigger: null,
    triggerDetails: {},
  }
}

export function finalizeCalibration(samples: MouthCropSample[]) {
  return finalizeMouthCropBaseline(samples)
}

export function getMissingFrameMetrics(): Partial<DebugMetrics> {
  return {
    phase: 'monitoring',
    trackingValid: false,
    trackingIssue: 'face not detected',
    contactScore: null,
    objectScore: null,
    motionScore: null,
    handScore: null,
    finalConfidence: null,
    mouthDistance: null,
    mouthOpenRatio: null,
    contactSamples: 0,
    motionSamples: 0,
    handNearMouthSamples: 0,
    handNearMouth: false,
    mouthCropBrightness: null,
    mouthCropContrast: null,
    mouthCropChange: null,
    mouthCropEdgeChange: null,
    mouthCenterBandChange: null,
    mouthCenterPeakChange: null,
  }
}

export function getCalibratingMetricsReset(): Partial<DebugMetrics> {
  return {
    phase: 'calibrating',
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
}

export function getMonitoringMetricsAfterCalibration(
  baseline: MouthCropBaseline,
): Partial<DebugMetrics> {
  return {
    phase: 'monitoring',
    trackingValid: true,
    trackingIssue: null,
    contactScore: null,
    objectScore: null,
    motionScore: null,
    handScore: null,
    finalConfidence: null,
    mouthDistance: null,
    mouthOpenRatio: null,
    baselineMouthDistance: baseline.mouthDistance,
    contactSamples: 0,
    motionSamples: 0,
    handNearMouthSamples: 0,
    handNearMouth: false,
    mouthCropBrightness: baseline.brightness,
    mouthCropContrast: baseline.contrast,
    mouthCropChange: null,
    mouthCropEdgeChange: null,
    mouthCenterBandChange: null,
    mouthCenterPeakChange: null,
  }
}
