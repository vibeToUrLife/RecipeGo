import { describe, it, expect } from 'vitest'
import { cleanNote, NOTE_MAX } from '@/lib/plan/note'

describe('cleanNote', () => {
  it('keeps a real note, trimmed', () => {
    expect(cleanNote('  double the chilli  ')).toBe('double the chilli')
  })

  it('collapses every flavour of "no note" to null', () => {
    // One stored value for "none", so a blanked note reads the same as one that
    // was never written.
    expect(cleanNote(null)).toBeNull()
    expect(cleanNote(undefined)).toBeNull()
    expect(cleanNote('')).toBeNull()
    expect(cleanNote('   \n  ')).toBeNull()
  })

  it('accepts a note right up to the limit', () => {
    const exact = 'x'.repeat(NOTE_MAX)
    expect(cleanNote(exact)).toBe(exact)
    // Padding doesn't count against the limit — it's trimmed first.
    expect(cleanNote(`  ${exact}  `)).toBe(exact)
  })

  it('rejects a note past the limit', () => {
    expect(cleanNote('x'.repeat(NOTE_MAX + 1))).toBeUndefined()
  })

  it('rejects anything that is not a string', () => {
    expect(cleanNote(42)).toBeUndefined()
    expect(cleanNote({ note: 'hi' })).toBeUndefined()
    expect(cleanNote(['hi'])).toBeUndefined()
  })
})
