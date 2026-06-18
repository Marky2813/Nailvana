import { cpSync, existsSync, mkdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const wasmSource = path.join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm')
const wasmTarget = path.join(root, 'public', 'mediapipe', 'wasm')
const modelsTarget = path.join(root, 'public', 'mediapipe', 'models')

const models = [
  {
    name: 'face_landmarker.task',
    url: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  },
  {
    name: 'hand_landmarker.task',
    url: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
  },
]

mkdirSync(wasmTarget, { recursive: true })
mkdirSync(modelsTarget, { recursive: true })
cpSync(wasmSource, wasmTarget, { recursive: true })

for (const model of models) {
  const targetPath = path.join(modelsTarget, model.name)

  if (existsSync(targetPath)) {
    continue
  }

  const response = await fetch(model.url)

  if (!response.ok) {
    throw new Error(`Failed to download ${model.name}: ${response.status}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  await import('fs/promises').then((fs) => fs.writeFile(targetPath, buffer))
  console.log(`Downloaded ${model.name}`)
}

console.log('MediaPipe assets ready in public/mediapipe')
