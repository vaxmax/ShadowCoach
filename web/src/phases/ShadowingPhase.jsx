import { useState, useRef } from 'react'
import KaraokePlayer from '../components/KaraokePlayer'
import Recorder from '../components/Recorder'
import ComparisonView from '../components/ComparisonView'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { saveAnalysis, getWordAttempts } from '../lib/db'
import { acquireModel, releaseModel, useModelLock } from '../lib/modelLock'
import logoSrc from '../logo.png'
import styles from './ShadowingPhase.module.css'

const VOICE_LABELS = {
  af_sarah:  'Sarah · US',
  am_adam:   'Adam · US',
  bf_emma:   'Emma · UK',
  bm_george: 'George · UK',
}

export default function ShadowingPhase({ session, text, voice, genTime, onNewText }) {
  const [recordingBlob, setRecordingBlob] = useState(null)
  const [analyzing,     setAnalyzing]     = useState(false)
  const [analysis,      setAnalysis]      = useState(null)
  const [analyzeError,  setAnalyzeError]  = useState(null)
  const [prevScores,    setPrevScores]    = useState({})
  const [analyzeTime,   setAnalyzeTime]   = useState(null)
  const modelLock = useModelLock()

  const playerRef   = useRef(null)
  const recorderRef = useRef(null)

  async function handleAnalyze(blob) {
    if (!acquireModel('whisper')) {
      setAnalyzeError('Whisper is busy — another transcription is already running. Please wait.')
      return
    }
    setAnalyzing(true)
    setAnalysis(null)
    setAnalyzeError(null)
    setAnalyzeTime(null)
    setRecordingBlob(blob)

    const t0 = performance.now()
    try {
      const form = new FormData()
      form.append('audio', blob, 'recording.webm')
      form.append('text', text)
      form.append('native_timings', JSON.stringify(session.timings))
      form.append('native_audio_filename', session.audio_url.split('/').pop())

      const res = await fetch('/api/analyze', { method: 'POST', body: form })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || `Server error ${res.status}`)
      }
      const data = await res.json()
      setAnalyzeTime(((performance.now() - t0) / 1000).toFixed(1))

      // Capture historical scores before saving so we can show deltas
      const historical = await getWordAttempts()
      const histMap = {}
      for (const a of historical) {
        if (!histMap[a.word]) histMap[a.word] = []
        histMap[a.word].push(a.score)
      }
      const prev = Object.fromEntries(
        Object.entries(histMap).map(([w, scores]) => [
          w,
          Math.round(scores.reduce((s, x) => s + x, 0) / scores.length),
        ])
      )
      setPrevScores(prev)

      // Persist session + word attempts
      const sessionId = crypto.randomUUID()
      const timestamp = new Date().toISOString()
      await saveAnalysis({
        session: {
          id:           sessionId,
          timestamp,
          text,
          voice,
          score:        data.score,
          raw_score:    data.rhythm?.raw_score ?? data.score,
          rhythm_ratio: data.rhythm?.ratio ?? 1,
          word_count:   data.results.length,
          matched_count: data.results.filter(r => r.matched).length,
        },
        words: data.results
          .filter(r => r.matched && r.combined_score != null)
          .map(r => ({
            id:         crypto.randomUUID(),
            session_id: sessionId,
            timestamp,
            word:       r.word.toLowerCase().replace(/[^a-z0-9']/g, ''),
            score:      r.combined_score,
            acoustic:   r.acoustic_score,
            clarity:    r.whisper_prob,
            context:    text,
          })),
      })

      setAnalysis(data)
    } catch (e) {
      setAnalyzeError(e.message)
    } finally {
      setAnalyzing(false)
      releaseModel('whisper')
    }
  }

  function handleNewText() {
    if (recordingBlob || analysis) {
      if (!window.confirm('Discard current recording and go back?')) return
    }
    onNewText()
  }

  useKeyboardShortcuts({
    ' ':      () => playerRef.current?.toggle(),
    'r':      () => recorderRef.current?.toggleRecording(),
    'R':      () => recorderRef.current?.toggleRecording(),
    'Escape': handleNewText,
  })

  const preview = text.length > 55 ? text.slice(0, 55) + '…' : text

  return (
    <div className={styles.page}>

      {/* ── Top bar ─────────────────────────────────── */}
      <header className={styles.topBar}>
        <div className={styles.topBarBrand}>
          <img src={logoSrc} alt="" className={styles.topBarLogo} />
          <span className={styles.topBarName}>AccentLab</span>
        </div>
        <button className={styles.backBtn} onClick={handleNewText} aria-label="New text">
          ← New text
        </button>
        <span className={styles.preview}>{preview}</span>
        <span className={styles.voiceBadge}>
          <svg width="10" height="8" viewBox="0 0 10 8" fill="currentColor" opacity="0.7">
            <rect x="0" y="2" width="1.5" height="4" rx="0.75"/>
            <rect x="2.5" y="1" width="1.5" height="6" rx="0.75"/>
            <rect x="5" y="0" width="1.5" height="8" rx="0.75"/>
            <rect x="7.5" y="1" width="1.5" height="6" rx="0.75"/>
          </svg>
          {VOICE_LABELS[voice] || voice}
        </span>
      </header>

      {/* ── API timings ─────────────────────────────── */}
      {(genTime || analyzeTime) && (
        <div className={styles.timingRow}>
          {genTime    && <span>TTS: {genTime}s</span>}
          {analyzeTime && <span>Analysis: {analyzeTime}s</span>}
        </div>
      )}

      {/* ── Native ──────────────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionLabel}>Native</span>
          <span className={styles.shortcut}>Space to play / pause</span>
        </div>
        <KaraokePlayer
          ref={playerRef}
          audioUrl={`/api${session.audio_url}`}
          timings={session.timings}
        />
      </section>

      {/* ── You ─────────────────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionLabel}>You</span>
          <span className={styles.shortcut}>R to record / stop</span>
        </div>
        <Recorder
          ref={recorderRef}
          onAnalyze={handleAnalyze}
          analyzing={analyzing || modelLock.whisper}
        />
        {(analyzing || modelLock.whisper) && (
          <p className={styles.analyzingMsg}>
            {analyzing ? 'Analyzing your recording…' : 'Whisper is busy — please wait…'}
          </p>
        )}
        {analyzeError && (
          <p className={styles.error}>{analyzeError}</p>
        )}
      </section>

      {/* ── Comparison ──────────────────────────────── */}
      {analysis && (
        <section className={styles.section}>
          <ComparisonView
            results={analysis.results}
            score={analysis.score}
            rhythm={analysis.rhythm}
            prevScores={prevScores}
            nativeAudioUrl={`/api${session.audio_url}`}
            nativeAudioFilename={session.audio_url.split('/').pop()}
            recordingBlob={recordingBlob}
            voice={voice}
          />
        </section>
      )}

    </div>
  )
}
