// Pure week/date helpers for the meal planner. No I/O — unit-tested.
export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner'] as const
export type MealSlot = (typeof MEAL_SLOTS)[number]

// Start (00:00 local) of the week containing `date`.
// weekStartsOn: 0=Sunday … 6=Saturday. Default 1 = Monday.
export function startOfWeek(date: Date, weekStartsOn = 1): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diff = (d.getDay() - weekStartsOn + 7) % 7 // days since the chosen start day
  d.setDate(d.getDate() - diff)
  return d
}

export function addWeeks(weekStart: Date, n: number): Date {
  const d = new Date(weekStart)
  d.setDate(d.getDate() + n * 7)
  return d
}

export function weekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })
}

// Local-time YYYY-MM-DD (avoids the UTC shift of toISOString()).
export function toISODate(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${m}-${day}`
}

export function fromISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// { 'YYYY-MM-DD': { breakfast: T[], lunch: T[], dinner: T[] } }
export function groupEntriesByDayAndSlot<
  T extends { plan_date: string; meal_slot: MealSlot },
>(entries: T[]): Record<string, Record<MealSlot, T[]>> {
  const out: Record<string, Record<MealSlot, T[]>> = {}
  for (const e of entries) {
    const day = (out[e.plan_date] ??= { breakfast: [], lunch: [], dinner: [] })
    day[e.meal_slot].push(e)
  }
  return out
}
