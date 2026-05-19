/**
 * Global lock for shared ML model resources.
 *
 * Two locks are tracked:
 *   'whisper' — faster-whisper transcription model (not thread-safe)
 *   'tts'     — Kokoro ONNX TTS model (not thread-safe)
 *
 * acquireModel(key)  → true if lock acquired, false if already held
 * releaseModel(key)  → releases the lock
 * useModelLock()     → React hook, re-renders when any lock state changes
 */

import { useState, useEffect } from 'react'

// Module-level state — shared across all mounted components
const _busy = { whisper: false, tts: false }
const _listeners = new Set()

function _notify() {
  const snap = { ..._busy }
  _listeners.forEach(fn => fn(snap))
}

/** Try to acquire a model lock. Returns true on success, false if already held. */
export function acquireModel(key) {
  if (_busy[key]) return false
  _busy[key] = true
  _notify()
  return true
}

/** Release a model lock. */
export function releaseModel(key) {
  _busy[key] = false
  _notify()
}

/** React hook — returns the current lock snapshot, re-renders on any change. */
export function useModelLock() {
  const [state, setState] = useState(() => ({ ..._busy }))
  useEffect(() => {
    _listeners.add(setState)
    return () => _listeners.delete(setState)
  }, [])
  return state
}
