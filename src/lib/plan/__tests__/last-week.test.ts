import { describe, it, expect } from 'vitest'
import { weekToOpen } from '@/lib/plan/last-week'

// Weeks start Monday (1) unless a case says otherwise.
const TODAY = '2026-08-03' // Mon 3 Aug 2026
const NEXT = '2026-08-10'
const LAST = '2026-07-27'

describe('weekToOpen', () => {
  it('opens on the current week with nothing to go on', () => {
    expect(weekToOpen(undefined, undefined, TODAY, 1)).toBe(TODAY)
  })

  it('restores the week the user was last looking at', () => {
    // The complaint this exists for: step to next week, go elsewhere, come back
    // via the nav's bare /plan link — and land on next week, not today.
    expect(weekToOpen(undefined, NEXT, TODAY, 1)).toBe(NEXT)
  })

  it('lets an explicit ?week= override what was remembered', () => {
    expect(weekToOpen(TODAY, NEXT, TODAY, 1)).toBe(TODAY)
    expect(weekToOpen('2026-08-17', NEXT, TODAY, 1)).toBe('2026-08-17')
  })

  it('drops a remembered week that has already gone by', () => {
    expect(weekToOpen(undefined, LAST, TODAY, 1)).toBe(TODAY)
  })

  it('ignores a malformed cookie rather than trusting it', () => {
    expect(weekToOpen(undefined, 'next-tuesday', TODAY, 1)).toBe(TODAY)
    expect(weekToOpen(undefined, '', TODAY, 1)).toBe(TODAY)
    expect(weekToOpen(undefined, '2026-8-3', TODAY, 1)).toBe(TODAY)
  })

  it('ignores a malformed ?week= the same way', () => {
    expect(weekToOpen('garbage', NEXT, TODAY, 1)).toBe(NEXT)
    expect(weekToOpen('garbage', undefined, TODAY, 1)).toBe(TODAY)
  })

  it('snaps a mid-week date back to that week’s start', () => {
    // Thu 13 Aug belongs to the week beginning Mon 10 Aug.
    expect(weekToOpen('2026-08-13', undefined, TODAY, 1)).toBe(NEXT)
    expect(weekToOpen(undefined, '2026-08-13', TODAY, 1)).toBe(NEXT)
  })

  it('honours a Sunday week start when normalising', () => {
    // With weeks starting Sunday, Mon 10 Aug sits in the week from Sun 9 Aug.
    expect(weekToOpen('2026-08-10', undefined, '2026-08-02', 0)).toBe('2026-08-09')
  })
})
