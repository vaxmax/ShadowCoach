// ── IndexedDB layer ───────────────────────────────────────────────────────
const DB_NAME    = 'shadow_coach_v1'
const DB_VERSION = 4

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = (event) => {
      const db  = event.target.result
      const txn = event.target.transaction
      const old = event.oldVersion

      if (!db.objectStoreNames.contains('sessions')) {
        const s = db.createObjectStore('sessions', { keyPath: 'id' })
        s.createIndex('timestamp', 'timestamp')
      }
      if (!db.objectStoreNames.contains('word_attempts')) {
        const w = db.createObjectStore('word_attempts', { keyPath: 'id' })
        w.createIndex('session_id', 'session_id')
        w.createIndex('word', 'word')
        w.createIndex('timestamp', 'timestamp')
      }
      if (!db.objectStoreNames.contains('anki_cards')) {
        db.createObjectStore('anki_cards', { keyPath: 'id', autoIncrement: true })
      }
      if (old < 3 && db.objectStoreNames.contains('anki_cards')) {
        const store = txn.objectStore('anki_cards')
        if (!store.indexNames.contains('catalog')) {
          store.createIndex('catalog', 'catalog')
        }
      }
    }
    req.onsuccess = ({ target: { result } }) => resolve(result)
    req.onerror   = ({ target: { error } })  => reject(error)
  })
}

function allFrom(store) {
  return new Promise((resolve, reject) => {
    const req = store.getAll()
    req.onsuccess = ({ target: { result } }) => resolve(result)
    req.onerror   = ({ target: { error } })  => reject(error)
  })
}

// ── Write ─────────────────────────────────────────────────────────────────

export async function saveAnalysis({ session, words }) {
  const db = await open()
  await new Promise((resolve, reject) => {
    const t = db.transaction(['sessions', 'word_attempts'], 'readwrite')
    t.oncomplete = resolve
    t.onerror    = ({ target: { error } }) => reject(error)
    t.objectStore('sessions').put(session)
    words.forEach(w => t.objectStore('word_attempts').put(w))
  })
  db.close()
}

// ── Read ──────────────────────────────────────────────────────────────────

export async function getSessions() {
  const db   = await open()
  const rows = await allFrom(db.transaction('sessions', 'readonly').objectStore('sessions'))
  db.close()
  return rows.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
}

export async function getWordAttempts() {
  const db   = await open()
  const rows = await allFrom(db.transaction('word_attempts', 'readonly').objectStore('word_attempts'))
  db.close()
  return rows
}

export async function getWordStats() {
  const attempts = await getWordAttempts()
  const map = {}
  for (const a of attempts) {
    if (!map[a.word]) map[a.word] = { word: a.word, scores: [], last: a.timestamp }
    map[a.word].scores.push(a.score)
    if (a.timestamp > map[a.word].last) map[a.word].last = a.timestamp
  }
  return Object.values(map)
    .map(({ word, scores, last }) => ({
      word,
      avg:    Math.round(scores.reduce((s, x) => s + x, 0) / scores.length),
      count:  scores.length,
      last,
      recent: scores.slice(-5),
    }))
    .sort((a, b) => a.avg - b.avg)
}

// ── Streak ────────────────────────────────────────────────────────────────

export function getStreak(sessions) {
  if (!sessions.length) return 0
  const days = new Set(sessions.map(s => s.timestamp.slice(0, 10)))
  const d    = new Date()
  if (!days.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1)
  let streak = 0
  while (days.has(d.toISOString().slice(0, 10))) {
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

// ── Personal best ─────────────────────────────────────────────────────────

export async function getBestForText(text) {
  const sessions = await getSessions()
  const key = text.trim().toLowerCase()
  const matches = sessions.filter(s => s.text.trim().toLowerCase() === key)
  if (!matches.length) return null
  return {
    best:  Math.max(...matches.map(s => s.score)),
    count: matches.length,
    last:  matches[0].timestamp,
  }
}

// ── Clear ─────────────────────────────────────────────────────────────────

export async function clearAll() {
  const db = await open()
  await new Promise((resolve, reject) => {
    const t = db.transaction(['sessions', 'word_attempts'], 'readwrite')
    t.oncomplete = resolve
    t.onerror    = ({ target: { error } }) => reject(error)
    t.objectStore('sessions').clear()
    t.objectStore('word_attempts').clear()
  })
  db.close()
}

// ── Export CSV ────────────────────────────────────────────────────────────

export async function exportCSV() {
  const [sessions, attempts] = await Promise.all([getSessions(), getWordAttempts()])
  const sessMap = Object.fromEntries(sessions.map(s => [s.id, s]))

  const rows = [
    ['date', 'word', 'score', 'acoustic', 'clarity_pct', 'session_score', 'text_preview'],
    ...attempts.map(a => {
      const sess = sessMap[a.session_id] || {}
      return [
        a.timestamp.slice(0, 10),
        a.word,
        a.score,
        a.acoustic ?? '',
        a.clarity !== null ? Math.round(a.clarity * 100) : '',
        sess.score ?? '',
        `"${(sess.text || '').slice(0, 60).replace(/"/g, '""')}"`,
      ]
    }),
  ]

  const csv  = rows.map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), {
    href:     url,
    download: `shadow-coach-${new Date().toISOString().slice(0, 10)}.csv`,
  })
  a.click()
  URL.revokeObjectURL(url)
}
