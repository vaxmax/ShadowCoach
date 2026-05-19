import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import styles from './Recorder.module.css'

// ── Audio enhancement chain ────────────────────────────────────────────────
// Inserts a Web Audio processing graph between the raw mic stream and the
// MediaRecorder so the recorded blob is already pre-processed.
//
//  Mic → HighPassFilter(80 Hz) → DynamicsCompressor → MediaStreamDestination
//
//  HighPassFilter  removes plosive bursts (P/B/T), proximity wind noise and
//                  low-frequency rumble common with close-mic headsets.
//
//  DynamicsCompressor  tames sudden volume peaks, normalises the overall level
//                      and prevents clipping from loud pronunciation attempts.
//
// Returns { processedStream, ctx } — call ctx.close() when done.
function buildProcessingChain(rawStream) {
  const ctx    = new AudioContext()
  const source = ctx.createMediaStreamSource(rawStream)

  const highpass        = ctx.createBiquadFilter()
  highpass.type         = 'highpass'
  highpass.frequency.value = 80   // Hz — cuts below this
  highpass.Q.value      = 0.7     // gentle slope

  const compressor            = ctx.createDynamicsCompressor()
  compressor.threshold.value  = -24  // dB — compress above this level
  compressor.knee.value       = 10   // soft knee for natural sound
  compressor.ratio.value      = 4    // 4:1 ratio
  compressor.attack.value     = 0.003 // 3 ms — fast enough to catch plosives
  compressor.release.value    = 0.25  // 250 ms

  const dest = ctx.createMediaStreamDestination()

  source.connect(highpass)
  highpass.connect(compressor)
  compressor.connect(dest)

  return { processedStream: dest.stream, ctx }
}
// ──────────────────────────────────────────────────────────────────────────

const Recorder = forwardRef(function Recorder({ onAnalyze, analyzing }, ref) {
  const [state,    setState]    = useState('idle')   // idle | recording | done
  const [blobUrl,  setBlobUrl]  = useState(null)
  const [blob,     setBlob]     = useState(null)
  const [elapsed,  setElapsed]  = useState(0)

  const mediaRecorderRef = useRef(null)
  const chunksRef        = useRef([])
  const timerRef         = useRef(null)
  const prevUrlRef       = useRef(null)
  const audioCtxRef      = useRef(null)  // holds the processing AudioContext

  useEffect(() => () => {
    clearInterval(timerRef.current)
    if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current)
    audioCtxRef.current?.close()
  }, [])

  async function startRecording() {
    try {
      const rawStream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // Build the enhancement chain; record from the processed output
      const { processedStream, ctx } = buildProcessingChain(rawStream)
      audioCtxRef.current = ctx

      const recorder = new MediaRecorder(processedStream)
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        rawStream.getTracks().forEach((t) => t.stop())
        ctx.close()
        const newBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
        if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current)
        const url = URL.createObjectURL(newBlob)
        prevUrlRef.current = url
        setBlobUrl(url); setBlob(newBlob); setState('done')
      }

      recorder.start()
      setState('recording')
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)
    } catch {
      setState('idle')
      alert('Microphone access denied. Please allow microphone permissions and try again.')
    }
  }

  function stopRecording() {
    clearInterval(timerRef.current)
    mediaRecorderRef.current?.stop()
  }

  function handleRedo() {
    setBlobUrl(null); setBlob(null); setState('idle'); setElapsed(0)
  }

  useImperativeHandle(ref, () => ({
    toggleRecording() {
      if (state === 'idle')           startRecording()
      else if (state === 'recording') stopRecording()
    },
  }), [state])

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.label}>Your recording</span>
        {state === 'done' && !analyzing && (
          <button className={styles.redo} onClick={handleRedo}>Record again</button>
        )}
      </div>

      {state === 'idle' && (
        <button className={styles.recordBtn} onClick={startRecording} aria-label="Start recording">
          <span className={styles.dot} /> Record
        </button>
      )}

      {state === 'recording' && (
        <div className={styles.recordingRow}>
          <button className={styles.stopBtn} onClick={stopRecording} aria-label="Stop recording">
            <span className={styles.square} /> Stop
          </button>
          <span className={styles.timer}><span className={styles.pulse} />{fmt(elapsed)}</span>
        </div>
      )}

      {state === 'done' && blobUrl && (
        <div className={styles.doneRow}>
          <audio className={styles.audio} src={blobUrl} controls />
          <button
            className={styles.analyzeBtn}
            onClick={() => onAnalyze(blob)}
            disabled={analyzing}
            aria-label="Analyze recording"
          >
            {analyzing ? 'Analyzing…' : 'Analyze'}
          </button>
        </div>
      )}
    </div>
  )
})

export default Recorder
