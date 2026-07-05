import { describe, it, expect } from 'vitest'
import { roomToRestore } from '@/lib/last-collection'

describe('roomToRestore', () => {
  const rooms = ['r1', 'r2']

  it('restores a remembered room the user still belongs to', () => {
    expect(roomToRestore(undefined, 'r1', rooms)).toBe('r1')
  })

  it('stays on personal when the user explicitly asked for it (?home=1)', () => {
    expect(roomToRestore('1', 'r1', rooms)).toBeNull()
  })

  it('stays on personal when nothing is remembered', () => {
    expect(roomToRestore(undefined, undefined, rooms)).toBeNull()
  })

  it('stays on personal when the remembered collection is "personal"', () => {
    expect(roomToRestore(undefined, 'personal', rooms)).toBeNull()
  })

  it('falls back to personal when the remembered room is no longer accessible', () => {
    expect(roomToRestore(undefined, 'gone', rooms)).toBeNull()
    expect(roomToRestore(undefined, 'r3', [])).toBeNull()
  })
})
