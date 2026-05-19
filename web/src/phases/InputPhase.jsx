import { useState, useRef, useEffect } from 'react'
import { getSessions, getStreak, getBestForText } from '../lib/db'
import { TEXT_LIBRARY, CATEGORIES, DIFFICULTIES } from '../data/textLibrary'
import logoSrc from '../logo.png'
import styles from './InputPhase.module.css'

function WaveIcon({ active }) {
  return (
    <svg width="13" height="10" viewBox="0 0 13 10" fill="currentColor"
      style={{ opacity: active ? 0.85 : 0.4, flexShrink: 0 }}>
      <rect x="0"  y="4" width="2" height="2" rx="1" />
      <rect x="3"  y="2" width="2" height="6" rx="1" />
      <rect x="6"  y="0" width="2" height="10" rx="1" />
      <rect x="9"  y="2" width="2" height="6" rx="1" />
      <rect x="12" y="4" width="1" height="2" rx="0.5" />
    </svg>
  )
}

const VOICES = [
  { id: 'af_sarah',  label: 'Sarah', accent: 'US' },
  { id: 'am_adam',   label: 'Adam',  accent: 'US' },
  { id: 'bf_emma',   label: 'Emma',  accent: 'UK' },
  { id: 'bm_george', label: 'George', accent: 'UK' },
]

const PLACEHOLDER = 'Paste or type an English text here…'
const WORD_LIMIT  = 250

export default function InputPhase({ onGenerate, onStats, loading, error, initialText, initialVoice }) {
  const [text,      setText]      = useState(initialText  || '')
  const [voice,     setVoice]     = useState(initialVoice || 'af_sarah')
  const [showLib,   setShowLib]   = useState(false)
  const [libCat,    setLibCat]    = useState(CATEGORIES[0])
  const [streak,    setStreak]    = useState(0)
  const [bestInfo,  setBestInfo]  = useState(null)
  const audioRef   = useRef(null)
  const bestTimer  = useRef(null)

  useEffect(() => {
    getSessions().then(sessions => setStreak(getStreak(sessions)))
  }, [])

  // Debounced personal best lookup
  useEffect(() => {
    clearTimeout(bestTimer.current)
    if (!text.trim()) { setBestInfo(null); return }
    bestTimer.current = setTimeout(() => {
      getBestForText(text).then(setBestInfo)
    }, 400)
    return () => clearTimeout(bestTimer.current)
  }, [text])

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length
  const overLimit = wordCount > WORD_LIMIT

  function handleSubmit(e) {
    e.preventDefault()
    if (text.trim() && !overLimit) onGenerate(text.trim(), voice)
  }

  function handleVoiceClick(voiceId) {
    setVoice(voiceId)
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    const a = new Audio(`/api/audio/samples/${voiceId}.wav`)
    audioRef.current = a
    a.play().catch(() => {})
  }

  function handlePickText(t) {
    setText(t.text)
    setShowLib(false)
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>

        {/* ── Brand ─────────────────────────────────── */}
        <div className={styles.brandRow}>
          <div className={styles.brand}>
            <img src={logoSrc} alt="" className={styles.logoImg} />
            <div className={styles.brandText}>
              <h1 className={styles.logo}>AccentLab</h1>
              <span className={styles.tagline}>Pronunciation lab</span>
            </div>
          </div>
          <div className={styles.brandActions}>
            {streak > 0 && (
              <span className={styles.streak} title={`${streak}-day streak`}>
                {streak} day streak
              </span>
            )}
            <button className={styles.statsBtn} onClick={onStats}>
              Stats
            </button>
          </div>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>

          {/* ── Textarea + library button ──────────── */}
          <div className={styles.textareaWrap}>
            <textarea
              className={styles.textarea}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={PLACEHOLDER}
              rows={7}
              disabled={loading}
            />
            <button
              type="button"
              className={styles.libraryBtn}
              onClick={() => setShowLib(true)}
              disabled={loading}
            >
              Browse library
            </button>
          </div>

          <div className={styles.textMeta}>
            <span className={overLimit ? styles.overLimit : styles.wordCount}>
              {wordCount} / {WORD_LIMIT} words
              {overLimit && ' — please shorten the text'}
            </span>
            {bestInfo && (
              <span className={styles.bestScore}>
                Best: <strong>{bestInfo.best}%</strong> · {bestInfo.count} {bestInfo.count === 1 ? 'attempt' : 'attempts'}
              </span>
            )}
          </div>

          {/* ── Voice selector ─────────────────────── */}
          <div className={styles.voiceSection}>
            <span className={styles.voiceLabel}>Voice</span>
            <div className={styles.voiceGroups}>
              {['US', 'UK'].map((accent) => (
                <div key={accent} className={styles.voiceGroup}>
                  <span className={styles.accentLabel}>{accent}</span>
                  <div className={styles.voicePills}>
                    {VOICES.filter((v) => v.accent === accent).map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        className={`${styles.pill} ${voice === v.id ? styles.pillActive : ''}`}
                        onClick={() => handleVoiceClick(v.id)}
                        disabled={loading}
                        title={`Preview ${v.label}'s voice`}
                      >
                        <WaveIcon active={voice === v.id} />
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button
            className={styles.generateBtn}
            type="submit"
            disabled={loading || !text.trim() || overLimit}
          >
            {loading && <span className={styles.spinner} />}
            {loading ? 'Generating…' : 'Generate'}
          </button>
        </form>
      </div>

      {/* ── Text library modal ───────────────────────── */}
      {showLib && (
        <div className={styles.modalBackdrop} onClick={() => setShowLib(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Text library</span>
              <button className={styles.modalClose} onClick={() => setShowLib(false)}>✕</button>
            </div>

            <div className={styles.catTabs}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  className={`${styles.catTab} ${libCat === cat ? styles.catTabActive : ''}`}
                  onClick={() => setLibCat(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className={styles.textCards}>
              {TEXT_LIBRARY.filter(t => t.category === libCat).map((t, i) => (
                <button key={i} className={styles.textCard} onClick={() => handlePickText(t)}>
                  <div className={styles.textCardHeader}>
                    <span className={styles.textCardTitle}>{t.title}</span>
                    {t.difficulty && (
                      <span className={styles.textCardDiff}>{DIFFICULTIES[t.difficulty]}</span>
                    )}
                  </div>
                  <span className={styles.textCardDesc}>{t.desc}</span>
                  <span className={styles.textCardPreview}>{t.text.slice(0, 80)}…</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
