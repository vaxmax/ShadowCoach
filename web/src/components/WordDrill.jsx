import { useState, useRef, useEffect } from 'react'
import styles from './WordDrill.module.css'

function scoreColor(s) {
  if (s == null) return 'var(--text-3)'
  return `hsl(${Math.round(s * 1.2)}, 65%, 58%)`
}

function scoreLabel(s) {
  if (s == null) return '—'
  if (s >= 85) return 'Excellent'
  if (s >= 70) return 'Good'
  if (s >= 50) return 'Fair'
  return 'Keep trying'
}

export default function WordDrill({ result, nativeAudioFilename, voice, onClose }) {
  const [phase,     setPhase]    = useState('idle')   // idle | recording | analyzing | done
  const [score,     setScore]    = useState(null)
  const [details,   setDetails]  = useState(null)     // { acoustic, clarity } breakdown
  const [error,     setError]    = useState(null)
  const [elapsed,   setElapsed]  = useState(0)
  const [recBlob,       setRecBlob]       = useState(null)   // saved recording for playback
  const [nativeTTS,     setNativeTTS]     = useState(null)   // cached TTS url for this word
  const [nativeLoading, setNativeLoading] = useState(false)  // generating TTS

  const mrRef     = useRef(null)
  const chunksRef = useRef([])
  const timerRef  = useRef(null)

  useEffect(() => () => { clearInterval(timerRef.current) }, [])

  async function playNative() {
    if (nativeLoading) return
    try {
      let url = nativeTTS
      if (!url) {
        setNativeLoading(true)
        const res  = await fetch('/api/generate', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ text: result.word, voice: voice || 'af_sarah' }),
        })
        const data = await res.json()
        url = `/api${data.audio_url}`
        setNativeTTS(url)
        setNativeLoading(false)
      }
      new Audio(url).play()
    } catch (e) {
      setNativeLoading(false)
      console.error('Native playback failed:', e)
    }
  }

  function playUser() {
    if (!recBlob) return
    try {
      const url   = URL.createObjectURL(recBlob)
      const audio = new Audio(url)
      audio.onended = () => URL.revokeObjectURL(url)
      audio.play().catch(e => console.warn('User playback failed:', e))
    } catch (e) {
      console.error('User playback failed:', e)
    }
  }

  async function startRecording() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      chunksRef.current = []

      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setRecBlob(blob)
        analyzeBlob(blob)
      }

      mr.start()
      mrRef.current = mr
      setPhase('recording')
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
    } catch {
      setError('Microphone access denied.')
    }
  }

  function stopRecording() {
    clearInterval(timerRef.current)
    mrRef.current?.stop()
    setPhase('analyzing')
  }

  async function analyzeBlob(blob) {
    try {
      const form = new FormData()
      form.append('audio', blob, 'drill.webm')
      form.append('text', result.word)
      form.append('native_timings', JSON.stringify([{
        word:        result.word,
        start:       result.native_start,
        end:         result.native_end,
        probability: 1.0,
      }]))
      form.append('native_audio_filename', nativeAudioFilename)

      const res  = await fetch('/api/analyze', { method: 'POST', body: form })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `Server error ${res.status}`)
      }
      const data = await res.json()
      const r = data.results?.[0]
      setScore(r?.combined_score ?? null)
      setDetails({
        acoustic: r?.acoustic_score ?? null,
        clarity:  r?.whisper_prob != null ? Math.round(r.whisper_prob * 100) : null,
      })
      setPhase('done')
    } catch (e) {
      setError(e.message)
      setPhase('idle')
    }
  }

  function reset() {
    clearInterval(timerRef.current)
    setPhase('idle')
    setScore(null)
    setDetails(null)
    setError(null)
    setElapsed(0)
    setRecBlob(null)
  }

  const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>
          Drill: <strong>{result.word}</strong>
        </span>
        <button className={styles.close} onClick={onClose} aria-label="Close drill">✕</button>
      </div>

      <p className={styles.hint}>
        Listen to the native pronunciation, then record yourself saying it.
      </p>

      <div className={styles.controls}>
        {/* Audio comparison row */}
        <div className={styles.audioRow}>
          <button className={styles.listenBtn} onClick={playNative} disabled={nativeLoading}>
            {nativeLoading ? 'Generating…' : '🔊 Native'}
          </button>
          {recBlob && (
            <button className={styles.listenBtn} onClick={playUser}>
              🔊 You
            </button>
          )}
        </div>

        {/* Record / Stop */}
        {phase === 'idle' && (
          <button className={styles.recordBtn} onClick={startRecording}>
            <span className={styles.dot} /> Record word
          </button>
        )}

        {phase === 'recording' && (
          <div className={styles.recordingRow}>
            <button className={styles.stopBtn} onClick={stopRecording}>
              <span className={styles.square} /> Stop
            </button>
            <span className={styles.timer}>
              <span className={styles.pulse} />{fmt(elapsed)}
            </span>
          </div>
        )}

        {phase === 'analyzing' && (
          <span className={styles.analyzing}>Analyzing…</span>
        )}

        {phase === 'done' && (
          <div className={styles.result}>
            {score != null ? (
              <>
                <div className={styles.scoreLine}>
                  <span className={styles.scoreVal} style={{ color: scoreColor(score) }}>
                    {score}%
                  </span>
                  <span className={styles.scoreLabel} style={{ color: scoreColor(score) }}>
                    {scoreLabel(score)}
                  </span>
                </div>
                {(details?.acoustic != null || details?.clarity != null) && (
                  <div className={styles.breakdown}>
                    {details.acoustic != null && (
                      <span className={styles.breakdownRow}>
                        <span className={styles.breakdownKey}>Acoustic</span>
                        <span style={{ color: scoreColor(details.acoustic) }}>{details.acoustic}%</span>
                      </span>
                    )}
                    {details.clarity != null && (
                      <span className={styles.breakdownRow}>
                        <span className={styles.breakdownKey}>Clarity</span>
                        <span style={{ color: scoreColor(details.clarity) }}>{details.clarity}%</span>
                      </span>
                    )}
                  </div>
                )}
                {result.combined_score != null && (
                  <span className={styles.delta}>
                    {score > result.combined_score
                      ? `↑ ${score - result.combined_score}% better than full read`
                      : score < result.combined_score
                        ? `↓ ${result.combined_score - score}% vs full read`
                        : '→ Same as full read'}
                  </span>
                )}
              </>
            ) : (
              <span className={styles.notDetected}>
                Word not detected — speak closer to the mic and pronounce it clearly
              </span>
            )}
            <button className={styles.retryBtn} onClick={reset}>Try again</button>
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}
      </div>
    </div>
  )
}
