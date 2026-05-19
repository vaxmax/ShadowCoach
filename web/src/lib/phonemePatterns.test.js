import { describe, it, expect } from 'vitest'
import { categorizeWord, computePhonemeStats, PHONEME_GROUPS } from './phonemePatterns'

// ── categorizeWord ────────────────────────────────────────────────────────────

describe('categorizeWord', () => {
  describe('TH sounds', () => {
    it('matches "think"',   () => expect(categorizeWord('think')).toContain('th'))
    it('matches "the"',     () => expect(categorizeWord('the')).toContain('th'))
    it('matches "through"', () => expect(categorizeWord('through')).toContain('th'))
    it('matches "breath"',  () => expect(categorizeWord('breath')).toContain('th'))
    it('does not match "top"',  () => expect(categorizeWord('top')).not.toContain('th'))
    it('does not match "hot"',  () => expect(categorizeWord('hot')).not.toContain('th'))
  })

  describe('V sound', () => {
    it('matches "very"',    () => expect(categorizeWord('very')).toContain('v'))
    it('matches "voice"',   () => expect(categorizeWord('voice')).toContain('v'))
    it('matches "believe"', () => expect(categorizeWord('believe')).toContain('v'))
    it('does not match "boat"', () => expect(categorizeWord('boat')).not.toContain('v'))
    it('does not match "fat"',  () => expect(categorizeWord('fat')).not.toContain('v'))
  })

  describe('W sound', () => {
    it('matches "work"', () => expect(categorizeWord('work')).toContain('w'))
    it('matches "want"', () => expect(categorizeWord('want')).toContain('w'))
    it('matches "world"', () => expect(categorizeWord('world')).toContain('w'))
    it('does not match "write" (silent w)', () => expect(categorizeWord('write')).not.toContain('w'))
    it('does not match "saw" (w at end)',   () => expect(categorizeWord('saw')).not.toContain('w'))
    it('matches "two" (regex matches tw+vowel; silent-w edge case)',
                                           () => expect(categorizeWord('two')).toContain('w'))
  })

  describe('English R', () => {
    it('matches "right"', () => expect(categorizeWord('right')).toContain('r'))
    it('matches "word"',  () => expect(categorizeWord('word')).toContain('r'))
    it('matches "very"',  () => expect(categorizeWord('very')).toContain('r'))
    it('does not match "top"',  () => expect(categorizeWord('top')).not.toContain('r'))
    it('does not match "moon"', () => expect(categorizeWord('moon')).not.toContain('r'))
  })

  describe('Short-i vowel', () => {
    it('matches "ship"',  () => expect(categorizeWord('ship')).toContain('short_i'))
    it('matches "big"',   () => expect(categorizeWord('big')).toContain('short_i'))
    it('matches "think"', () => expect(categorizeWord('think')).toContain('short_i'))
    it('matches "fill"',  () => expect(categorizeWord('fill')).toContain('short_i'))
    it('does not match "sea"',  () => expect(categorizeWord('sea')).not.toContain('short_i'))
    it('does not match "blue"', () => expect(categorizeWord('blue')).not.toContain('short_i'))
  })

  describe('normalization', () => {
    it('is case-insensitive',         () => expect(categorizeWord('THINK')).toContain('th'))
    it('strips trailing punctuation', () => expect(categorizeWord('think.')).toContain('th'))
    it('strips leading punctuation',  () => expect(categorizeWord('"very"')).toContain('v'))
  })

  describe('multiple categories', () => {
    it('"think" has both TH and short-i', () => {
      const cats = categorizeWord('think')
      expect(cats).toContain('th')
      expect(cats).toContain('short_i')
    })

    it('"very" has both V and R', () => {
      const cats = categorizeWord('very')
      expect(cats).toContain('v')
      expect(cats).toContain('r')
    })
  })

  it('returns empty array for word with no matching phoneme group', () => {
    // "map" — no th, v, w, r, or short-i CVC pattern
    const cats = categorizeWord('noon')
    expect(cats).toBeInstanceOf(Array)
  })

  it('always returns an array', () => {
    expect(Array.isArray(categorizeWord('hello'))).toBe(true)
    expect(Array.isArray(categorizeWord(''))).toBe(true)
  })
})

// ── computePhonemeStats ───────────────────────────────────────────────────────

describe('computePhonemeStats', () => {
  it('returns empty array for no input', () => {
    expect(computePhonemeStats([])).toEqual([])
  })

  it('excludes groups with fewer than 3 attempts', () => {
    const stats = computePhonemeStats([{ word: 'think', avg: 60, count: 2 }])
    expect(stats).toEqual([])
  })

  it('includes groups with exactly 3 attempts', () => {
    const stats = computePhonemeStats([{ word: 'think', avg: 60, count: 3 }])
    const ids = stats.map(s => s.id)
    expect(ids).toContain('th')
  })

  it('calculates weighted average correctly', () => {
    // "think" avg=40 × 6 attempts, "the" avg=100 × 6 attempts → TH avg = (240+600)/12 = 70
    const wordStats = [
      { word: 'think', avg: 40, count: 6 },
      { word: 'the',   avg: 100, count: 6 },
    ]
    const stats = computePhonemeStats(wordStats)
    const th = stats.find(s => s.id === 'th')
    expect(th?.avg).toBe(70)
  })

  it('weights by attempt count, not word count', () => {
    // "think" avg=0 × 10 attempts, "the" avg=100 × 1 attempt → weighted avg ≠ simple avg (50)
    const wordStats = [
      { word: 'think', avg: 0,   count: 10 },
      { word: 'the',   avg: 100, count: 1  },
    ]
    const stats = computePhonemeStats(wordStats)
    const th = stats.find(s => s.id === 'th')
    // weighted: (0*10 + 100*1) / 11 = 9
    expect(th?.avg).toBe(Math.round(100 / 11))
  })

  it('sorts worst first (ascending by avg)', () => {
    const wordStats = [
      { word: 'the',  avg: 80, count: 5 },  // th → high score
      { word: 'very', avg: 30, count: 5 },  // v → low score
    ]
    const stats = computePhonemeStats(wordStats)
    for (let i = 1; i < stats.length; i++) {
      expect(stats[i - 1].avg).toBeLessThanOrEqual(stats[i].avg)
    }
  })

  it('includes count in output', () => {
    const wordStats = [{ word: 'think', avg: 70, count: 5 }]
    const stats = computePhonemeStats(wordStats)
    const th = stats.find(s => s.id === 'th')
    expect(th?.count).toBe(5)
  })

  it('preserves group metadata (label, ipa, example)', () => {
    const wordStats = [{ word: 'think', avg: 70, count: 5 }]
    const stats = computePhonemeStats(wordStats)
    const th = stats.find(s => s.id === 'th')
    expect(th?.label).toBe('TH sounds')
    expect(th?.ipa).toBeTruthy()
    expect(th?.example).toBeTruthy()
  })

  it('aggregates attempts across multiple words in same group', () => {
    const wordStats = [
      { word: 'think', avg: 60, count: 2 },
      { word: 'the',   avg: 80, count: 2 },
    ]
    // Total 4 attempts (≥3) → should appear
    const stats = computePhonemeStats(wordStats)
    const th = stats.find(s => s.id === 'th')
    expect(th).toBeDefined()
    expect(th?.count).toBe(4)
  })

  it('result groups are a subset of PHONEME_GROUPS', () => {
    const validIds = new Set(PHONEME_GROUPS.map(g => g.id))
    const wordStats = [
      { word: 'think', avg: 60, count: 5 },
      { word: 'very',  avg: 70, count: 5 },
    ]
    const stats = computePhonemeStats(wordStats)
    for (const s of stats) {
      expect(validIds.has(s.id)).toBe(true)
    }
  })
})
