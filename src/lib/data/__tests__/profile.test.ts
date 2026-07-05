import { describe, it, expect, vi, beforeEach } from 'vitest'

const holder = vi.hoisted(() => ({
  user: { id: 'u1' } as { id: string } | null,
  single: { data: { week_starts_on: 0 } as { week_starts_on: number } | null, error: null as unknown },
}))
vi.mock('@/utils/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: holder.user } }) },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => holder.single }) }) }),
  }),
}))
import { getWeekStartsOn } from '@/lib/data/profile'

beforeEach(() => {
  holder.user = { id: 'u1' }
  holder.single = { data: { week_starts_on: 0 }, error: null }
})

describe('getWeekStartsOn', () => {
  it('returns the stored preference', async () => {
    holder.single = { data: { week_starts_on: 0 }, error: null }
    expect(await getWeekStartsOn()).toBe(0)
  })
  it('defaults to 1 when not signed in', async () => {
    holder.user = null
    expect(await getWeekStartsOn()).toBe(1)
  })
  it('defaults to 1 on a query error (e.g. column missing pre-migration)', async () => {
    holder.single = { data: null, error: { message: 'column does not exist' } }
    expect(await getWeekStartsOn()).toBe(1)
  })
  it('defaults to 1 for an out-of-range value', async () => {
    holder.single = { data: { week_starts_on: 9 }, error: null }
    expect(await getWeekStartsOn()).toBe(1)
  })
})
