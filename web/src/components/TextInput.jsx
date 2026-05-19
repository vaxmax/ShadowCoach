import { useState } from 'react'
import styles from './TextInput.module.css'

const PLACEHOLDER = `Paste an English text here and click Generate.\n\nExample: "The quick brown fox jumps over the lazy dog."`

export default function TextInput({ onGenerate, loading }) {
  const [text, setText] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (text.trim()) onGenerate(text.trim())
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <textarea
        className={styles.textarea}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={PLACEHOLDER}
        rows={6}
        disabled={loading}
      />
      <div className={styles.footer}>
        <span className={styles.hint}>
          {text.trim().split(/\s+/).filter(Boolean).length} words
        </span>
        <button
          className={styles.button}
          type="submit"
          disabled={loading || !text.trim()}
        >
          {loading ? 'Generating…' : 'Generate'}
        </button>
      </div>
    </form>
  )
}
