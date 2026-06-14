import {
  FaceLandmarker,
  FilesetResolver,
  HandLandmarker,
} from '@mediapipe/tasks-vision'
import {
  FACE_LANDMARKER_MODEL_URL,
  HAND_LANDMARKER_MODEL_URL,
  WASM_FILES_URL,
} from './constants'

export type MediaPipeLandmarkers = {
  faceLandmarker: FaceLandmarker
  handLandmarker: HandLandmarker
}

export async function initializeMediaPipeLandmarkers(): Promise<MediaPipeLandmarkers> {
  const vision = await FilesetResolver.forVisionTasks(WASM_FILES_URL)

  const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: FACE_LANDMARKER_MODEL_URL,
    },
    runningMode: 'VIDEO',
    numFaces: 1,
    outputFaceBlendshapes: false,
  })

  const handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: HAND_LANDMARKER_MODEL_URL,
    },
    runningMode: 'VIDEO',
    numHands: 2,
  })

  return { faceLandmarker, handLandmarker }
}

export function waitForVideoDimensions(video: HTMLVideoElement) {
  if (video.videoWidth > 0 && video.videoHeight > 0) {
    return Promise.resolve()
  }

  return new Promise<void>((resolve) => {
    video.addEventListener('loadedmetadata', () => resolve(), { once: true })
  })
}
