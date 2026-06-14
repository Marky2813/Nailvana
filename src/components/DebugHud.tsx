import { playChewingAlertSound } from '../detection/alertSound'
import {
  CONTACT_SCORE_THRESHOLD,
  CONSECUTIVE_SAMPLES_REQUIRED,
  HAND_SCORE_THRESHOLD,
  MOTION_SCORE_THRESHOLD,
  OBJECT_CENTER_BAND_THRESHOLD,
  OBJECT_CENTER_PEAK_THRESHOLD,
  OBJECT_SCORE_THRESHOLD,
} from '../detection/constants'
import { formatMetric, type DebugMetrics } from '../detection/types'

type DebugHudProps = {
  debugMetrics: DebugMetrics
  onRecalibrate: () => void
}

function yesNo(value: boolean) {
  return value ? 'yes' : 'no'
}

export function DebugHud({ debugMetrics, onRecalibrate }: DebugHudProps) {
  const objectCandidate =
    debugMetrics.objectScore !== null &&
    debugMetrics.mouthCenterBandChange !== null &&
    debugMetrics.mouthCenterPeakChange !== null &&
    debugMetrics.objectScore >= OBJECT_SCORE_THRESHOLD &&
    debugMetrics.mouthCenterBandChange >= OBJECT_CENTER_BAND_THRESHOLD &&
    debugMetrics.mouthCenterPeakChange >= OBJECT_CENTER_PEAK_THRESHOLD

  return (
    <div className="w-full max-w-3xl rounded-lg border border-zinc-800 bg-zinc-900 p-4 font-mono text-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-sans text-base font-medium text-zinc-200">Debug HUD</div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void playChewingAlertSound()}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1 font-sans text-xs text-zinc-200 hover:bg-zinc-700"
          >
            Test sound
          </button>
          <button
            type="button"
            onClick={() => void onRecalibrate()}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1 font-sans text-xs text-zinc-200 hover:bg-zinc-700"
          >
            Recalibrate
          </button>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          State: <span className="text-emerald-400">{debugMetrics.phase}</span>
        </div>
        <div>
          Tracking:{' '}
          <span className={debugMetrics.trackingValid ? 'text-emerald-400' : 'text-amber-400'}>
            {debugMetrics.trackingValid ? 'valid' : (debugMetrics.trackingIssue ?? 'waiting')}
          </span>
        </div>
        <div>
          Contact score:{' '}
          <span
            className={
              debugMetrics.contactScore !== null &&
              debugMetrics.contactScore >= CONTACT_SCORE_THRESHOLD
                ? 'text-orange-400'
                : 'text-zinc-300'
            }
          >
            {formatMetric(debugMetrics.contactScore)}
          </span>
        </div>
        <div>
          Object score:{' '}
          <span
            className={
              objectCandidate ? 'text-orange-400' : 'text-zinc-300'
            }
          >
            {formatMetric(debugMetrics.objectScore)}
          </span>
        </div>
        <div>
          Motion score:{' '}
          <span
            className={
              debugMetrics.motionScore !== null &&
              debugMetrics.motionScore >= MOTION_SCORE_THRESHOLD
                ? 'text-orange-400'
                : 'text-zinc-300'
            }
          >
            {formatMetric(debugMetrics.motionScore)}
          </span>
        </div>
        <div>
          Hand score:{' '}
          <span
            className={
              debugMetrics.handScore !== null && debugMetrics.handScore >= HAND_SCORE_THRESHOLD
                ? 'text-orange-400'
                : 'text-zinc-300'
            }
          >
            {formatMetric(debugMetrics.handScore)}
          </span>
        </div>
        <div>Final confidence: {formatMetric(debugMetrics.finalConfidence)}</div>
        <div>
          Contact samples:{' '}
          <span className="text-sky-400">
            {debugMetrics.contactSamples} / {CONSECUTIVE_SAMPLES_REQUIRED}
          </span>
        </div>
        <div>
          Motion samples:{' '}
          <span className="text-sky-400">
            {debugMetrics.motionSamples} / {CONSECUTIVE_SAMPLES_REQUIRED}
          </span>
        </div>
        <div>
          Hand samples:{' '}
          <span className="text-sky-400">
            {debugMetrics.handNearMouthSamples} / {CONSECUTIVE_SAMPLES_REQUIRED}
          </span>
        </div>
        <div>
          Hand near mouth:{' '}
          <span className={debugMetrics.handNearMouth ? 'text-orange-400' : 'text-zinc-300'}>
            {yesNo(debugMetrics.handNearMouth)}
          </span>
        </div>
        <div>Baseline mouth distance: {formatMetric(debugMetrics.baselineMouthDistance, 1)}</div>
        <div>Mouth distance: {formatMetric(debugMetrics.mouthDistance, 1)}</div>
        <div>Mouth open ratio: {formatMetric(debugMetrics.mouthOpenRatio, 2)}</div>
        <div>Crop brightness: {formatMetric(debugMetrics.mouthCropBrightness)}</div>
        <div>Crop contrast: {formatMetric(debugMetrics.mouthCropContrast)}</div>
        <div>Crop change: {formatMetric(debugMetrics.mouthCropChange)}</div>
        <div>Edge change: {formatMetric(debugMetrics.mouthCropEdgeChange)}</div>
        <div>Center band change: {formatMetric(debugMetrics.mouthCenterBandChange)}</div>
        <div>Center peak change: {formatMetric(debugMetrics.mouthCenterPeakChange)}</div>
        <div>
          Calibration samples:{' '}
          <span className="text-sky-400">{debugMetrics.calibrationSampleCount}</span>
        </div>
      </div>
      <div className="mt-3 font-sans text-xs text-zinc-500">
        Detection uses a local mouth crop, mouth-motion history, and optional hand proximity. Invalid
        tracking pauses alerts instead of guessing.
      </div>
    </div>
  )
}
