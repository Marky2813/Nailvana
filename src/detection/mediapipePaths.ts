function getBundledAssetUrl(relativePath: string) {
  return new URL(`${import.meta.env.BASE_URL}${relativePath}`, window.location.href).href
}

export const WASM_FILES_URL = getBundledAssetUrl('mediapipe/wasm')
export const FACE_LANDMARKER_MODEL_URL = getBundledAssetUrl('mediapipe/models/face_landmarker.task')
export const HAND_LANDMARKER_MODEL_URL = getBundledAssetUrl('mediapipe/models/hand_landmarker.task')
