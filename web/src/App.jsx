import { useState, useEffect } from 'react'
import InputPhase      from './phases/InputPhase'
import ShadowingPhase  from './phases/ShadowingPhase'
import StatsPhase      from './phases/StatsPhase'
import { acquireModel, releaseModel } from './lib/modelLock'

const SESSION_KEY = 'shadow_coach_session_v1'
const VOICE_KEY   = 'shadow_coach_voice_v1'

function loadSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) } catch { return null }
}
function saveSession(data) { sessionStorage.setItem(SESSION_KEY, JSON.stringify(data)) }
function clearSession()    { sessionStorage.removeItem(SESSION_KEY) }

export default function App() {
  const savedVoice = localStorage.getItem(VOICE_KEY) || 'af_sarah'

  const [phase,   setPhase]   = useState('input')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [text,    setText]    = useState('')
  const [voice,   setVoice]   = useState(savedVoice)
  const [session, setSession] = useState(null)
  const [genTime, setGenTime] = useState(null)

  useEffect(() => {
    const saved = loadSession()
    if (saved?.audio_url && saved?.timings) {
      setText(saved.text   || '')
      setVoice(saved.voice || savedVoice)
      setSession({ audio_url: saved.audio_url, timings: saved.timings })
      setPhase('shadowing')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleGenerate(inputText, inputVoice) {
    if (!acquireModel('tts')) {
      setError('TTS is busy — audio is already being generated. Please wait.')
      return
    }
    setLoading(true)
    setError(null)
    setGenTime(null)

    localStorage.setItem(VOICE_KEY, inputVoice)

    const t0 = performance.now()
    try {
      const res = await fetch('/api/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text: inputText, voice: inputVoice }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || `Server error ${res.status}`)
      }
      const data = await res.json()
      setGenTime(((performance.now() - t0) / 1000).toFixed(1))

      setText(inputText)
      setVoice(inputVoice)
      setSession(data)
      saveSession({ text: inputText, voice: inputVoice, ...data })
      setPhase('shadowing')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
      releaseModel('tts')
    }
  }

  function handleNewText() {
    clearSession()
    setSession(null)
    setError(null)
    setPhase('input')
  }

  function handlePractice(practiceText, practiceVoice) {
    setText(practiceText)
    if (practiceVoice) setVoice(practiceVoice)
    setPhase('input')
  }

  if (phase === 'stats') {
    return (
      <div style={{ minHeight: '100vh', background: '#0f0f1a' }}>
        <StatsPhase
          onBack={() => setPhase('input')}
          onPractice={handlePractice}
        />
      </div>
    )
  }

  if (phase === 'shadowing' && session) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f0f1a' }}>
        <ShadowingPhase
          session={session}
          text={text}
          voice={voice}
          genTime={genTime}
          onNewText={handleNewText}
        />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f1a' }}>
      <InputPhase
        onGenerate={handleGenerate}
        onStats={() => setPhase('stats')}
        loading={loading}
        error={error}
        initialText={text}
        initialVoice={voice}
      />
    </div>
  )
}
