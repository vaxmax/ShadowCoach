// Phoneme pattern detection for Spanish speakers learning English.
// Uses simple string rules on normalized words — not perfect, but
// captures the most common cases reliably enough to be useful.

export const PHONEME_GROUPS = [
  {
    id:      'th',
    label:   'TH sounds',
    ipa:     '/θ/ · /ð/',
    example: 'think · the · through',
    test:    w => w.includes('th'),
  },
  {
    id:      'v',
    label:   'V sound',
    ipa:     '/v/',
    example: 'very · voice · believe',
    test:    w => w.includes('v'),
  },
  {
    id:      'w',
    label:   'W sound',
    ipa:     '/w/',
    example: 'work · world · want',
    // starts with w, or contains w mid-word (between, always, forward)
    // exclude -wl- and silent w (write, wrap) by requiring a vowel after
    test:    w => /^w[aeiouy]/.test(w) || /[bcdfghjklmnprstxyz]w[aeiouy]/.test(w),
  },
  {
    id:      'r',
    label:   'English R',
    ipa:     '/r/',
    example: 'right · round · word',
    test:    w => w.includes('r'),
  },
  {
    id:      'short_i',
    label:   'Short-i vowel',
    ipa:     '/ɪ/',
    example: 'ship · think · big',
    // consonant-i-consonant pattern (not followed by 'ng' already caught above)
    test:    w => /[bcdfghjklmnprstwxyz]i[bcdfghjklmnprstwxyz]/.test(w),
  },
]

/**
 * Returns array of group IDs this word belongs to.
 */
export function categorizeWord(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '')
  return PHONEME_GROUPS.filter(g => g.test(w)).map(g => g.id)
}

/**
 * Given wordStats from db.getWordStats(), compute per-group averages.
 * Returns groups sorted by avg ascending (worst first).
 * Only includes groups with at least MIN_ATTEMPTS data points.
 */
const MIN_ATTEMPTS = 3

export function computePhonemeStats(wordStats) {
  const groups = {}

  for (const ws of wordStats) {
    const cats = categorizeWord(ws.word)
    for (const cat of cats) {
      if (!groups[cat]) groups[cat] = { total: 0, count: 0 }
      // Weight by number of attempts for this word
      groups[cat].total += ws.avg * ws.count
      groups[cat].count += ws.count
    }
  }

  return PHONEME_GROUPS
    .filter(g => (groups[g.id]?.count ?? 0) >= MIN_ATTEMPTS)
    .map(g => ({
      ...g,
      avg:   Math.round(groups[g.id].total / groups[g.id].count),
      count: groups[g.id].count,
    }))
    .sort((a, b) => a.avg - b.avg)
}
