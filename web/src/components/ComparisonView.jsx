import { useRef, useEffect, useCallback, useState } from 'react'
import WordDrill from './WordDrill'
import { getTip } from '../data/pronunciationTips'
import styles from './ComparisonView.module.css'

const CHUNK_PAD_BEFORE = 0.05
const CHUNK_PAD_AFTER  = 0.28

function useAudioContext() {
  const ctxRef = useRef(null)
  useEffect(() => { return () => { ctxRef.current?.close(); ctxRef.current = null } }, [])
  return function getCtx() {
    if (!ctxRef.current || ctxRef.current.state === 'closed')
      ctxRef.current = new AudioContext()
    return ctxRef.current
  }
}

async function decodeSource(source, ctx) {
  let ab
  if (source instanceof Blob) { ab = await source.arrayBuffer() }
  else { const r = await fetch(source); ab = await r.arrayBuffer() }
  return ctx.decodeAudioData(ab)
}

function playSlice(buffer, ctx, start, end) {
  if (ctx.state === 'suspended') ctx.resume()
  const s = Math.max(0, start - CHUNK_PAD_BEFORE)
  const e = Math.min(buffer.duration, end + CHUNK_PAD_AFTER)
  const src = ctx.createBufferSource()
  src.buffer = buffer
  src.connect(ctx.destination)
  src.start(0, s, e - s)
}

function scoreToColor(score) {
  if (score === null) return 'hsl(150, 45%, 45%)'
  const hue = Math.round(score * 1.2)
  return `hsl(${hue}, 65%, 58%)`
}

function scoreGrade(score) {
  if (score === null) return null
  if (score >= 85) return 'Excellent'
  if (score >= 70) return 'Good'
  if (score >= 50) return 'Fair'
  return 'Needs work'
}

function paceLabel(pacePct) {
  if (pacePct >= 90 && pacePct <= 115) return 'On pace'
  if (pacePct < 90)  return `${pacePct}% pace · too slow`
  return `${pacePct}% pace · too fast`
}

function paceColor(pacePct) {
  if (pacePct >= 85 && pacePct <= 120) return 'var(--success)'
  if (pacePct >= 65 && pacePct <= 140) return 'var(--warning)'
  return 'var(--error)'
}

// ── Word detail panel ──────────────────────────────────────────────────────
function WordDetail({ result, prevScores, onDrill, onClose, nativeAudioFilename }) {
  const tip   = getTip(result.word)
  const score = result.combined_score
  const color = result.matched ? scoreToColor(score) : 'var(--error)'

  const key      = result.word.toLowerCase().replace(/[^a-z0-9']/g, '')
  const prev     = prevScores?.[key]
  const delta    = prev != null && score != null ? score - prev : null
  const arrow    = delta == null ? null : delta > 5 ? '↑' : delta < -5 ? '↓' : '→'
  const deltaCol = delta == null ? null
    : delta > 5 ? 'var(--success)' : delta < -5 ? 'var(--error)' : 'var(--text-3)'

  const canDrill = (score != null && score < 70) || !result.matched

  return (
    <div className={styles.detailPanel}>
      <div className={styles.detailHeader}>
        <span className={styles.detailWord}>{result.word}</span>
        <button className={styles.detailClose} onClick={onClose} aria-label="Close detail">✕</button>
      </div>

      {result.matched ? (
        <div className={styles.detailBody}>
          {score != null && (
            <div className={styles.detailScoreRow}>
              <span className={styles.detailGrade} style={{ color }}>{scoreGrade(score)}</span>
              <div className={styles.detailBarWrap}>
                <div className={styles.detailBarFill} style={{ width: `${score}%`, background: color }} />
              </div>
              <span className={styles.detailPct} style={{ color }}>{score}%</span>
            </div>
          )}
          <div className={styles.detailMeta}>
            {result.acoustic_score != null && (
              <div className={styles.detailRow}>
                <span className={styles.detailKey}>Acoustic</span>
                <span style={{ color: scoreToColor(result.acoustic_score) }}>{result.acoustic_score}%</span>
              </div>
            )}
            {result.whisper_prob != null && (
              <div className={styles.detailRow}>
                <span className={styles.detailKey}>Clarity</span>
                <span style={{ color: scoreToColor(Math.round(result.whisper_prob * 100)) }}>
                  {Math.round(result.whisper_prob * 100)}%
                </span>
              </div>
            )}
            {delta != null && (
              <div className={styles.detailRow}>
                <span className={styles.detailKey}>vs history</span>
                <span style={{ color: deltaCol }}>{arrow} {delta > 0 ? '+' : ''}{delta}%</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <span className={styles.detailNotDetected}>Word not detected</span>
      )}

      {tip && (
        <div className={styles.detailTip}>
          <span className={styles.detailTipIcon}>💡</span>
          <span>{tip}</span>
        </div>
      )}

      {canDrill && nativeAudioFilename && (
        <button className={styles.detailDrillBtn} onClick={onDrill}>
          🎤 Drill this word
        </button>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function ComparisonView({
  results, score, rhythm, prevScores,
  nativeAudioUrl, nativeAudioFilename, recordingBlob, voice,
}) {
  const getCtx       = useAudioContext()
  const nativeBufRef = useRef(null)
  const userBufRef   = useRef(null)
  const [selectedResult, setSelectedResult] = useState(null)
  const [drillResult,    setDrillResult]    = useState(null)

  useEffect(() => { nativeBufRef.current = null }, [nativeAudioUrl])
  useEffect(() => { userBufRef.current   = null }, [recordingBlob])

  async function getNative() {
    const ctx = getCtx()
    if (!nativeBufRef.current) nativeBufRef.current = await decodeSource(nativeAudioUrl, ctx)
    return { buf: nativeBufRef.current, ctx }
  }

  async function getUser() {
    const ctx = getCtx()
    if (!userBufRef.current) userBufRef.current = await decodeSource(recordingBlob, ctx)
    return { buf: userBufRef.current, ctx }
  }

  // Left-click: select word + play native audio
  // Right-click: play user audio
  const handleWordClick = useCallback(async (e, r) => {
    e.preventDefault()
    try {
      if (e.type === 'click') {
        setSelectedResult(r)
        if (r.native_start !== null) {
          const { buf, ctx } = await getNative()
          playSlice(buf, ctx, r.native_start, r.native_end)
        }
      } else if (e.type === 'contextmenu' && r.matched && r.user_start !== null) {
        const { buf, ctx } = await getUser()
        playSlice(buf, ctx, r.user_start, r.user_end)
      }
    } catch (err) {
      console.error('Audio playback failed:', err)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- getNative/getUser are inner fns
  }, [nativeAudioUrl, recordingBlob])

  const matched     = results.filter((r) => r.matched).length
  const globalColor = scoreToColor(score)

  return (
    <div className={styles.container}>

      {/* ── Header with score ───────────────────────── */}
      <div className={styles.header}>
        <span className={styles.label}>Comparison</span>

        <div className={styles.scoreBlock}>
          <span className={styles.scoreGrade} style={{ color: globalColor }}>
            {scoreGrade(score)}
          </span>

          {/* Score pill with tooltip breakdown */}
          <span className={styles.scoreWrap}>
            <div className={styles.scorePill}>
              <div
                className={styles.scoreFill}
                style={{ width: `${score}%`, background: globalColor }}
              />
              <span className={styles.scoreNum} style={{ color: globalColor }}>
                {score}%
              </span>
            </div>
            <span className={styles.scoreTip}>
              <span className={styles.tipScore} style={{ color: globalColor }}>
                Overall score: {score}%
              </span>
              <span className={styles.tipRow}>
                <span className={styles.tipKey}>Word avg</span>
                <span>{rhythm?.raw_score ?? score}%</span>
              </span>
              {rhythm && rhythm.factor < 1 && (
                <span className={styles.tipRow}>
                  <span className={styles.tipKey}>Pace penalty</span>
                  <span style={{ color: 'var(--error)' }}>−{Math.round((1 - rhythm.factor) * 100)}%</span>
                </span>
              )}
              <span className={styles.tipRow} style={{ marginTop: 4, paddingTop: 4, borderTop: '1px solid var(--border)' }}>
                <span className={styles.tipKey}>Per-word score</span>
                <span>60% acoustic + 40% clarity</span>
              </span>
              <span className={styles.tipRow}>
                <span className={styles.tipKey}>Overall</span>
                <span>avg × pace factor</span>
              </span>
              <span className={styles.tipArrow} />
            </span>
          </span>

          <span className={styles.scoreMeta}>{matched} / {results.length} words</span>
          {rhythm && (
            <span className={styles.scoreMeta} style={{ color: paceColor(rhythm.pace_pct) }}>
              {paceLabel(rhythm.pace_pct)}
            </span>
          )}
        </div>
      </div>

      <p className={styles.hint}>
        <span className={styles.hintKey}>Click</span> word · native audio + details
        &ensp;·&ensp;
        <span className={styles.hintKey}>Right-click</span> your recording
      </p>

      {/* ── Words ───────────────────────────────────── */}
      <div className={styles.text}>
        {results.map((r, i) => {
          const color    = r.matched ? scoreToColor(r.combined_score) : null
          const isSelected = selectedResult === r

          return (
            <span key={i} className={styles.wordWrap}>
              <span
                className={`${styles.word} ${r.matched ? styles.matched : styles.missed} ${isSelected ? styles.wordSelected : ''}`}
                style={color ? { color } : undefined}
                onClick={(e) => handleWordClick(e, r)}
                onContextMenu={(e) => handleWordClick(e, r)}
              >
                {r.word}
              </span>
              {' '}
            </span>
          )
        })}
      </div>

      {/* ── Selected word detail panel ───────────────── */}
      {selectedResult && (
        <WordDetail
          result={selectedResult}
          prevScores={prevScores}
          nativeAudioFilename={nativeAudioFilename}
          onDrill={() => setDrillResult(selectedResult)}
          onClose={() => setSelectedResult(null)}
        />
      )}

      {/* ── Word drill panel ─────────────────────────── */}
      {drillResult && nativeAudioFilename && (
        <WordDrill
          result={drillResult}
          nativeAudioFilename={nativeAudioFilename}
          voice={voice}
          onClose={() => setDrillResult(null)}
        />
      )}
    </div>
  )
}
