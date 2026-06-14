import './App.css'
import { CameraView } from '../components/CameraView'
import { DebugHud } from '../components/DebugHud'
import { useChewingDetection } from '../hooks/useChewingDetection'

function App() {
  const {
    videoRef,
    canvasRef,
    status,
    calibrationSecondsLeft,
    triggerMessage,
    debugMetrics,
    recalibrate,
  } = useChewingDetection()

  return (
    <main className="flex min-h-screen flex-col items-center gap-4 bg-zinc-950 px-6 py-8 text-zinc-100">
      <div className="text-2xl font-semibold">CatchChew</div>

      <CameraView
        videoRef={videoRef}
        canvasRef={canvasRef}
        calibrationSecondsLeft={calibrationSecondsLeft}
        triggerMessage={triggerMessage}
      />

      <DebugHud debugMetrics={debugMetrics} onRecalibrate={recalibrate} />

      <div className="status min-h-6 text-sm text-red-300">{status}</div>
    </main>
  )
}

export default App
