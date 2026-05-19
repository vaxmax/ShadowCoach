import { useState, useEffect } from 'react'
import { getSessions, getWordStats, getStreak, clearAll, exportCSV } from '../lib/db'
import { computePhonemeStats } from '../lib/phonemePatterns'
import logoSrc from '../logo.png'
import styles from './StatsPhase.module.css'

// ── Helpers ───────────────────────────────────────────────────────────────

function scoreColor(score) {
  if (score === null || score === undefined) return 'var(--text-3)'
  const hue = Math.round(score * 1.2)
  return `hsl(${hue}, 65%, 58%)`
}

function relativeDate(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7)  return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function buildDrillText(wordStats) {
  const worst = wordStats.slice(0, 10).map(w => w.word)
  if (!worst.length) return ''
  const list = worst.join(', ')
  return `Please practice these words: ${list}. Let me try each one: ${worst.slice(0, 5).join(', ')}.`
}

// ── Sparkline ─────────────────────────────────────────────────────────────

function Sparkline({ sessions }) {
  const pts = sessions.slice(0, 20).reverse()
  if (pts.length < 2) {
    return <p className={styles.noData}>Practice at least 2 sessions to see your trend.</p>
  }
  const W = 100, H = 40, PAD = 3
  const xs = pts.map((_, i) => PAD + (i / (pts.length - 1)) * (W - 2 * PAD))
  const ys = pts.map(s => PAD + (1 - s.score / 100) * (H - 2 * PAD))
  const d  = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
  const last = pts[pts.length - 1].score
  const col  = last >= 70 ? 'var(--success)' : last >= 50 ? 'var(--warning)' : 'var(--error)'

  return (
    <div className={styles.sparklineWrap}>
      <div className={styles.sparklineYAxis}>
        <span>100%</span>
        <span>50%</span>
        <span>0%</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.sparklineSvg} preserveAspectRatio="none">
        {/* Guide lines */}
        {[0, 0.5, 1].map((v, i) => (
          <line key={i}
            x1={PAD} y1={PAD + v * (H - 2 * PAD)}
            x2={W - PAD} y2={PAD + v * (H - 2 * PAD)}
            stroke="var(--border)" strokeWidth="0.4"
          />
        ))}
        {/* Fill */}
        <path
          d={`${d} L${xs[xs.length - 1].toFixed(1)},${H - PAD} L${xs[0].toFixed(1)},${H - PAD} Z`}
          fill={col} opacity="0.07"
        />
        {/* Line */}
        <path d={d} fill="none" stroke={col} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Latest dot */}
        <circle cx={xs[xs.length - 1].toFixed(1)} cy={ys[ys.length - 1].toFixed(1)} r="2.5" fill={col} />
      </svg>
    </div>
  )
}

// ── Mini score dots (word history) ────────────────────────────────────────

function ScoreDots({ scores }) {
  return (
    <div className={styles.scoreDots}>
      {scores.map((s, i) => (
        <span key={i} className={styles.scoreDot} style={{ background: scoreColor(s) }} title={`${s}%`}>
          {s}%
        </span>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────

export default function StatsPhase({ onBack, onPractice }) {
  const [sessions,     setSessions]     = useState([])
  const [wordStats,    setWordStats]    = useState([])
  const [loading,      setLoading]      = useState(true)
  const [expandedWord, setExpandedWord] = useState(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [tab,          setTab]          = useState('words') // 'words' | 'sessions'

  useEffect(() => {
    Promise.all([getSessions(), getWordStats()]).then(([s, w]) => {
      setSessions(s)
      setWordStats(w)
      setLoading(false)
    })
  }, [])

  const streak       = getStreak(sessions)
  const totalPracticed = sessions.reduce((s, x) => s + (x.matched_count || 0), 0)
  const avgScore     = sessions.length
    ? Math.round(sessions.reduce((s, x) => s + x.score, 0) / sessions.length)
    : 0
  const weakWords    = wordStats.slice(0, 20)
  const drillText    = buildDrillText(wordStats)
  const phonemeStats = computePhonemeStats(wordStats)

  async function handleClear() {
    await clearAll()
    setSessions([])
    setWordStats([])
    setConfirmClear(false)
  }

  function handleDrill() {
    if (drillText) onPractice(drillText, null)
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <header className={styles.topBar}>
          <div className={styles.topBarBrand}>
            <img src={logoSrc} alt="" className={styles.topBarLogo} />
            <span className={styles.topBarName}>AccentLab</span>
          </div>
          <button className={styles.backBtn} onClick={onBack}>← Back</button>
          <span className={styles.title}>Statistics</span>
        </header>
        <div className={styles.loadingMsg}>Loading your history…</div>
      </div>
    )
  }

  const empty = sessions.length === 0

  return (
    <div className={styles.page}>

      {/* ── Top bar ──────────────────────────────────── */}
      <header className={styles.topBar}>
        <div className={styles.topBarBrand}>
          <img src={logoSrc} alt="" className={styles.topBarLogo} />
          <span className={styles.topBarName}>AccentLab</span>
        </div>
        <button className={styles.backBtn} onClick={onBack}>← Back</button>
        <span className={styles.title}>Statistics</span>
        <div className={styles.topActions}>
          {!empty && (
            <button className={styles.actionBtn} onClick={exportCSV}>
              Export CSV
            </button>
          )}
          {!empty && !confirmClear && (
            <button className={`${styles.actionBtn} ${styles.danger}`} onClick={() => setConfirmClear(true)}>
              Clear data
            </button>
          )}
          {confirmClear && (
            <span className={styles.confirmRow}>
              <span className={styles.confirmText}>Delete all history?</span>
              <button className={`${styles.actionBtn} ${styles.danger}`} onClick={handleClear}>Yes, delete</button>
              <button className={styles.actionBtn} onClick={() => setConfirmClear(false)}>Cancel</button>
            </span>
          )}
        </div>
      </header>

      {empty ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>No practice sessions yet</p>
          <p className={styles.emptyDesc}>Complete your first analysis to start tracking your progress.</p>
          <button className={styles.emptyBtn} onClick={onBack}>← Start practicing</button>
        </div>
      ) : (
        <>
          {/* ── Overview ───────────────────────────── */}
          <section className={styles.section}>
            <div className={styles.statsGrid}>
              <div className={styles.stat}>
                <span className={styles.statNum}>{sessions.length}</span>
                <span className={styles.statLabel}>Sessions</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statNum} style={{ color: scoreColor(avgScore) }}>{avgScore}%</span>
                <span className={styles.statLabel}>Avg score</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statNum}>{totalPracticed}</span>
                <span className={styles.statLabel}>Words practiced</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statNum} style={{ color: streak > 0 ? 'var(--warning)' : undefined }}>
                  {streak > 0 ? `${streak} 🔥` : '—'}
                </span>
                <span className={styles.statLabel}>Day streak</span>
              </div>
            </div>
            <Sparkline sessions={sessions} />
          </section>

          {/* ── Phoneme insights ───────────────────── */}
          {phonemeStats.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionTitle}>Phoneme insights</div>
              <div className={styles.phonemeList}>
                {phonemeStats.map(g => (
                  <div key={g.id} className={styles.phonemeRow}>
                    <div className={styles.phonemeMeta}>
                      <span className={styles.phonemeLabel}>{g.label}</span>
                      <span className={styles.phonemeIpa}>{g.ipa}</span>
                      <span className={styles.phonemeExample}>{g.example}</span>
                    </div>
                    <div className={styles.phonemeBarWrap}>
                      <div
                        className={styles.phonemeBar}
                        style={{ width: `${g.avg}%`, background: scoreColor(g.avg) }}
                      />
                    </div>
                    <span className={styles.phonemeScore} style={{ color: scoreColor(g.avg) }}>
                      {g.avg}%
                    </span>
                    <span className={styles.phonemeCount}>{g.count}×</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Tabs ───────────────────────────────── */}
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${tab === 'words' ? styles.tabActive : ''}`}
              onClick={() => setTab('words')}
            >
              Weak words <span className={styles.tabCount}>{weakWords.length}</span>
            </button>
            <button
              className={`${styles.tab} ${tab === 'sessions' ? styles.tabActive : ''}`}
              onClick={() => setTab('sessions')}
            >
              Session history <span className={styles.tabCount}>{sessions.length}</span>
            </button>
          </div>

          {/* ── Weak words tab ─────────────────────── */}
          {tab === 'words' && (
            <section className={styles.section}>
              {weakWords.length === 0 ? (
                <p className={styles.emptyDesc}>No word data yet.</p>
              ) : (
                <>
                  <div className={styles.tableHeader}>
                    <span className={styles.tableHeaderLabel}>
                      Sorted by average score (worst first)
                    </span>
                    {drillText && (
                      <button className={styles.drillBtn} onClick={handleDrill}>
                        Practice weak words →
                      </button>
                    )}
                  </div>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Word</th>
                        <th>Avg</th>
                        <th>Tries</th>
                        <th>Last</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {weakWords.map(w => (
                        <>
                          <tr
                            key={w.word}
                            className={`${styles.wordRow} ${expandedWord === w.word ? styles.wordRowExpanded : ''}`}
                            onClick={() => setExpandedWord(expandedWord === w.word ? null : w.word)}
                          >
                            <td className={styles.wordCell}>{w.word}</td>
                            <td>
                              <span className={styles.scorePill} style={{ color: scoreColor(w.avg), borderColor: scoreColor(w.avg) + '44' }}>
                                {w.avg}%
                              </span>
                            </td>
                            <td className={styles.dimCell}>{w.count}×</td>
                            <td className={styles.dimCell}>{relativeDate(w.last)}</td>
                            <td className={styles.chevron}>{expandedWord === w.word ? '▲' : '▼'}</td>
                          </tr>
                          {expandedWord === w.word && (
                            <tr key={`${w.word}-exp`} className={styles.expansionRow}>
                              <td colSpan={5}>
                                <div className={styles.expansionContent}>
                                  <span className={styles.expansionLabel}>Last {w.recent.length} attempts:</span>
                                  <ScoreDots scores={w.recent} />
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </section>
          )}

          {/* ── Session history tab ─────────────────── */}
          {tab === 'sessions' && (
            <section className={styles.section}>
              <div className={styles.sessionList}>
                {sessions.map(s => (
                  <div key={s.id} className={styles.sessionCard}>
                    <div className={styles.sessionMeta}>
                      <span className={styles.sessionDate}>{formatDate(s.timestamp)}</span>
                      <span className={styles.sessionScore} style={{ color: scoreColor(s.score) }}>
                        {s.score}%
                      </span>
                    </div>
                    <p className={styles.sessionText}>{s.text.slice(0, 80)}{s.text.length > 80 ? '…' : ''}</p>
                    <div className={styles.sessionFooter}>
                      <span className={styles.sessionWords}>{s.matched_count}/{s.word_count} words matched</span>
                      <button
                        className={styles.repracticeBtn}
                        onClick={() => onPractice(s.text, s.voice)}
                      >
                        ↩ Re-practice
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
