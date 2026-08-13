'use client'
import { useEffect } from 'react'

// Persists the week the plan is showing, so leaving the plan and coming back
// through the nav (which links to a bare "/plan") returns you to the week you
// were on instead of snapping to today. Written client-side because server
// components can't set cookies; read back in the plan pages. Mirrors
// RememberCollection, which does the same for the active room.
export function RememberPlanWeek({ weekStartISO }: { weekStartISO: string }) {
  useEffect(() => {
    // YYYY-MM-DD — no escaping needed. A week's lifetime: long enough to carry a
    // planning session, short enough that it lapses instead of going stale.
    document.cookie = `last_plan_week=${weekStartISO}; path=/; max-age=604800; samesite=lax`
  }, [weekStartISO])
  return null
}
