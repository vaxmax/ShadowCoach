import { useEffect, useRef } from 'react'

/**
 * Bind keyboard shortcuts globally.
 * shortcuts: { [key]: () => void }
 * Does NOT fire when focus is inside an input/textarea/select.
 * Uses a ref so the shortcuts object can be recreated on every render
 * without removing/re-adding the event listener.
 */
export function useKeyboardShortcuts(shortcuts) {
  const ref = useRef(shortcuts)

  useEffect(() => {
    ref.current = shortcuts
  })

  useEffect(() => {
    function handler(e) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable) return
      const fn = ref.current[e.key]
      if (fn) {
        e.preventDefault()
        fn()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}
