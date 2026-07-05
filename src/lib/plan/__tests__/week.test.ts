import { describe, it, expect } from 'vitest'
import {
  startOfWeek, addWeeks, weekDays, toISODate, fromISODate,
  groupEntriesByDayAndSlot, MEAL_SLOTS,
} from '@/lib/plan/week'

describe('startOfWeek', () => {
  it('returns the same day for a Monday', () => {
    expect(toISODate(startOfWeek(new Date(2026, 5, 29)))).toBe('2026-06-29') // Mon 29 Jun 2026
  })
  it('returns Monday for a mid-week day', () => {
    expect(toISODate(startOfWeek(new Date(2026, 6, 1)))).toBe('2026-06-29') // Wed 1 Jul -> Mon 29 Jun
  })
  it('returns the previous Monday for a Sunday', () => {
    expect(toISODate(startOfWeek(new Date(2026, 6, 5)))).toBe('2026-06-29') // Sun 5 Jul -> Mon 29 Jun
  })
  it('supports a Sunday start (weekStartsOn=0)', () => {
    expect(toISODate(startOfWeek(new Date(2026, 6, 1), 0))).toBe('2026-06-28') // Wed 1 Jul -> Sun 28 Jun
    expect(toISODate(startOfWeek(new Date(2026, 6, 5), 0))).toBe('2026-07-05') // Sun 5 Jul -> same Sunday
  })
  it('supports a Wednesday start (weekStartsOn=3)', () => {
    expect(toISODate(startOfWeek(new Date(2026, 6, 1), 3))).toBe('2026-07-01') // Wed 1 Jul -> same Wednesday
    expect(toISODate(startOfWeek(new Date(2026, 5, 30), 3))).toBe('2026-06-24') // Tue 30 Jun -> prev Wed 24 Jun
  })
  it('defaults to a Monday start when weekStartsOn is omitted', () => {
    expect(toISODate(startOfWeek(new Date(2026, 6, 1)))).toBe('2026-06-29') // Wed 1 Jul -> Mon 29 Jun
  })
})

describe('weekDays', () => {
  it('returns 7 consecutive days Mon..Sun', () => {
    const days = weekDays(new Date(2026, 5, 29)).map(toISODate)
    expect(days).toEqual([
      '2026-06-29', '2026-06-30', '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05',
    ])
  })
})

describe('addWeeks', () => {
  it('shifts by whole weeks forward and back', () => {
    expect(toISODate(addWeeks(new Date(2026, 5, 29), 1))).toBe('2026-07-06')
    expect(toISODate(addWeeks(new Date(2026, 5, 29), -1))).toBe('2026-06-22')
  })
})

describe('toISODate / fromISODate', () => {
  it('pads and round-trips with no off-by-one', () => {
    expect(toISODate(new Date(2026, 0, 3))).toBe('2026-01-03')
    expect(toISODate(fromISODate('2026-01-03'))).toBe('2026-01-03')
  })
})

describe('groupEntriesByDayAndSlot', () => {
  it('buckets by day then slot and keeps multiple per slot', () => {
    const g = groupEntriesByDayAndSlot([
      { plan_date: '2026-06-29', meal_slot: 'dinner', id: 'a' },
      { plan_date: '2026-06-29', meal_slot: 'dinner', id: 'b' },
      { plan_date: '2026-06-30', meal_slot: 'breakfast', id: 'c' },
    ])
    expect(g['2026-06-29'].dinner.map((e) => e.id)).toEqual(['a', 'b'])
    expect(g['2026-06-29'].breakfast).toEqual([])
    expect(g['2026-06-30'].breakfast.map((e) => e.id)).toEqual(['c'])
  })
  it('exposes the three slots in order', () => {
    expect(MEAL_SLOTS).toEqual(['breakfast', 'lunch', 'dinner'])
  })
})
