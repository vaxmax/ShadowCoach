import { describe, it, expect } from 'vitest'
import { getStreak } from './db'

// Helper: ISO timestamp for N days ago (arbitrary time within that day)
function daysAgo(n, hour = 12) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

function session(daysBack, hour = 12) {
  return { timestamp: daysAgo(daysBack, hour) }
}

describe('getStreak', () => {
  it('returns 0 for empty sessions', () => {
    expect(getStreak([])).toBe(0)
  })

  it('returns 1 when only today practiced', () => {
    expect(getStreak([session(0)])).toBe(1)
  })

  it('returns 1 when only yesterday practiced', () => {
    expect(getStreak([session(1)])).toBe(1)
  })

  it('returns 0 when last session was 2 days ago (gap)', () => {
    expect(getStreak([session(2)])).toBe(0)
  })

  it('returns streak for consecutive days including today', () => {
    expect(getStreak([session(0), session(1), session(2)])).toBe(3)
  })

  it('returns streak for consecutive days ending yesterday', () => {
    expect(getStreak([session(1), session(2), session(3)])).toBe(3)
  })

  it('stops counting at a gap', () => {
    // today + 2 days ago — gap on day 1
    expect(getStreak([session(0), session(2), session(3)])).toBe(1)
  })

  it('stops counting at a gap in a streak ending yesterday', () => {
    // yesterday + 3 days ago — gap on day 2
    expect(getStreak([session(1), session(3), session(4)])).toBe(1)
  })

  it('handles multiple sessions on the same day (counts as 1)', () => {
    const sessions = [
      session(0, 9),
      session(0, 20),
      session(1),
    ]
    expect(getStreak(sessions)).toBe(2)
  })

  it('works with sessions provided in any order', () => {
    // Out-of-order input — streak logic uses a Set so order does not matter
    const sessions = [session(2), session(0), session(1)]
    expect(getStreak(sessions)).toBe(3)
  })

  it('returns correct streak for a long run', () => {
    const sessions = Array.from({ length: 7 }, (_, i) => session(i))
    expect(getStreak(sessions)).toBe(7)
  })
})
