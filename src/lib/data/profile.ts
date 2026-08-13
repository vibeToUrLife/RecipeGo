import { createClient } from '@/utils/supabase/server'

// The user's preferred first day of the week: 0=Sunday … 6=Saturday.
// Defaults to 1 (Monday). Tolerates the column not existing yet — production
// deploys before the migration is applied, so a select on week_starts_on errors
// until then; in every failure path we fall back to Monday.
export async function getWeekStartsOn(): Promise<number> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return 1
    const { data, error } = await supabase
      .from('profiles')
      .select('week_starts_on')
      .eq('id', user.id)
      .single()
    if (error || data?.week_starts_on == null) return 1
    const v = Number(data.week_starts_on)
    return Number.isInteger(v) && v >= 0 && v <= 6 ? v : 1
  } catch {
    return 1
  }
}
