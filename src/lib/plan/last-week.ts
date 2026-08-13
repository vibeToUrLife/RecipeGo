import { startOfWeek, fromISODate, toISODate } from '@/lib/plan/week'

const ISO = /^\d{4}-\d{2}-\d{2}$/

// Which week the plan should open on. The nav links to a bare "/plan", so
// without this, stepping forward a week and then going to look at a recipe
// snapped you back to today on the way in.
//
//  - an explicit ?week= always wins — that's a deliberate navigation
//  - otherwise the last week the user was looking at, so leaving the plan and
//    coming back keeps their place
//  - a remembered week that has already gone by is dropped: opening on a week
//    you can no longer shop for is worse than opening on today
//  - anything missing or malformed falls back to the current week
export function weekToOpen(
  weekParam: string | undefined,
  remembered: string | undefined,
  todayWeekISO: string,
  weekStartsOn: number,
): string {
  const normalise = (s: string) => toISODate(startOfWeek(fromISODate(s), weekStartsOn))
  if (weekParam && ISO.test(weekParam)) return normalise(weekParam)
  if (remembered && ISO.test(remembered)) {
    // Both sides are YYYY-MM-DD week starts, so a string compare is a date
    // compare.
    const week = normalise(remembered)
    if (week >= todayWeekISO) return week
  }
  return todayWeekISO
}
