export const WASM_FILES_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
export const FACE_LANDMARKER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
export const HAND_LANDMARKER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

export const HAND_TRACKING_LANDMARK_INDICES = [0, 4, 8, 12, 16, 20]
export const FINGERTIP_LANDMARK_INDICES = [4, 8, 12, 16, 20]
export const FACE_BOUNDS_PADDING_SCALE = 0.2
export const HAND_NEAR_MOUTH_RADIUS_SCALE = 0.1
export const MIN_HAND_NEAR_MOUTH_RADIUS_PX = 28
export const UNIFORM_SATURATION_SPREAD_MAX = 0.035
export const HEAD_TOUCH_MARGIN_PX = 12

export const SAMPLE_INTERVAL_MS = 250
export const CALIBRATION_DURATION_MS = 3000
export const CONTACT_SCORE_THRESHOLD = 0.68
export const OBJECT_SCORE_THRESHOLD = 0.72
export const OBJECT_CENTER_BAND_THRESHOLD = 0.07
export const OBJECT_CENTER_PEAK_THRESHOLD = 0.16
export const MOTION_SCORE_THRESHOLD = 0.62
export const HAND_SCORE_THRESHOLD = 0.8
export const SATURATION_THRESHOLD = 0.08
export const CONSECUTIVE_SAMPLES_REQUIRED = 16
export const LIP_REGION_COUNT = 3
export const MIN_STRIP_HEIGHT_PX = 8
export const REGION_LABELS = ['left', 'center', 'right'] as const
export const FACE_WAIT_TIMEOUT_MS = 15000
export const TRIGGER_RESET_MS = 2000
export const MOUTH_CROP_WIDTH = 64
export const MOUTH_CROP_HEIGHT = 48
export const MOUTH_CROP_BASELINE_ALPHA = 0.04
export const MIN_FACE_WIDTH_RATIO = 0.14
export const MAX_FACE_WIDTH_RATIO = 0.72
export const FACE_CENTER_MARGIN_RATIO = 0.17
export const MOUTH_CROP_EDGE_MARGIN_PX = 6
export const MOUTH_OPEN_BLOCK_DISTANCE_PX = 20
