import { forwardRef, useImperativeHandle, useRef, useState, useEffect, useCallback } from 'react'
import styles from './KaraokePlayer.module.css'

const SPEEDS = [0.6, 0.8, 1.0]

// Binary search: find last timing whose start ≤ currentTime
function getCurrentWordIndex(currentTime, timings) {
  if (!timings.length) return -1
  let lo = 0, hi = timings.length - 1, idx = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (timings[mid].start <= currentTime) { idx = mid; lo = mid + 1 }
    else hi = mid - 1
  }
  return idx
}

const KaraokePlayer = forwardRef(function KaraokePlayer({ audioUrl, timings }, ref) {
  const audioRef      = useRef(null)
  const activeWordRef = useRef(null)
  const [activeIdx, setActiveIdx] = useState(-1)
  const [playing,   setPlaying]   = useState(false)
  const [progress,  setProgress]  = useState(0)
  const [duration,  setDuration]  = useState(0)
  const [speed,     setSpeed]     = useState(1.0)

  useEffect(() => {
    setActiveIdx(-1); setPlaying(false); setProgress(0)
  }, [audioUrl])

  useEffect(() => {
    activeWordRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeIdx])

  // Apply speed to audio element whenever it changes
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed
  }, [speed])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) { audio.pause(); setPlaying(false) }
    else         { audio.play();  setPlaying(true)  }
  }, [playing])

  useImperativeHandle(ref, () => ({ toggle: togglePlay }), [togglePlay])

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    setActiveIdx(getCurrentWordIndex(audio.currentTime, timings))
    setProgress(audio.duration ? audio.currentTime / audio.duration : 0)
  }, [timings])

  function handleEnded() {
    setPlaying(false); setActiveIdx(-1); setProgress(0)
    if (audioRef.current) audioRef.current.currentTime = 0
  }

  function handleSeek(e) {
    const audio = audioRef.current
    if (!audio || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * duration
  }

  function handleLoadedMetadata() {
    const audio = audioRef.current
    if (!audio) return
    setDuration(audio.duration ?? 0)
    audio.playbackRate = speed
  }

  // Click a word → seek to its start time and play from there
  function handleWordClick(t) {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = t.start
    audio.play().catch(e => console.warn('Segment playback failed:', e))
    setPlaying(true)
  }

  function formatTime(s) {
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  }

  return (
    <div className={styles.container}>
      <div className={styles.text}>
        {timings.map((t, i) => (
          <span
            key={i}
            ref={i === activeIdx ? activeWordRef : null}
            className={`${styles.word} ${i === activeIdx ? styles.active : ''} ${i < activeIdx ? styles.past : ''}`}
            onClick={() => handleWordClick(t)}
            title="Click to jump here"
          >
            {t.word}{' '}
          </span>
        ))}
      </div>

      <div className={styles.player}>
        <button
          className={styles.playBtn}
          onClick={togglePlay}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? (
            <svg width="11" height="13" viewBox="0 0 11 13" fill="currentColor">
              <rect x="0" y="0" width="3.5" height="13" rx="1.5" />
              <rect x="7.5" y="0" width="3.5" height="13" rx="1.5" />
            </svg>
          ) : (
            <svg width="12" height="13" viewBox="0 0 12 13" fill="currentColor" style={{ marginLeft: '1px' }}>
              <path d="M1 1.5L11 6.5L1 11.5V1.5Z" />
            </svg>
          )}
        </button>

        <div className={styles.seekBar} onClick={handleSeek} role="progressbar">
          <div className={styles.seekFill} style={{ width: `${progress * 100}%` }} />
        </div>

        <span className={styles.time}>
          {formatTime(audioRef.current?.currentTime ?? 0)} / {formatTime(duration)}
        </span>

        <div className={styles.speedBtns}>
          {SPEEDS.map(s => (
            <button
              key={s}
              className={`${styles.speedBtn} ${speed === s ? styles.speedActive : ''}`}
              onClick={() => setSpeed(s)}
              aria-label={`${s}× speed`}
            >
              {s === 1 ? '1×' : `${s}×`}
            </button>
          ))}
        </div>
      </div>

      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />
    </div>
  )
})

export default KaraokePlayer
