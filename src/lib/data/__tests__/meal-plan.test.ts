import { describe, it, expect, vi, beforeEach } from 'vitest'

// meal-plan.ts imports 'server-only' (a build-time guard against client bundling);
// neutralize it under the jsdom test environment.
vi.mock('server-only', () => ({}))

const holder = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[] }))
// The week's query as getWeekPlan builds it, ending in the scope filter.
vi.mock('@/utils/supabase/server', () => ({
  createClient: async () => {
    const rows = () => Promise.resolve({ data: holder.rows, error: null })
    return {
      from: () => ({
        select: () => ({ gte: () => ({ lte: () => ({ order: () => ({ eq: rows, is: rows }) }) }) }),
      }),
    }
  },
}))
vi.mock('@/lib/data/shopping', () => ({ addRecipeToList: vi.fn() }))
import { getWeekPlan } from '@/lib/data/meal-plan'

const row = (over: Record<string, unknown>): Record<string, unknown> => ({
  id: 'e1',
  user_id: 'u1',
  room_id: null,
  recipe_id: 'r1',
  plan_date: '2026-06-29',
  meal_slot: 'dinner',
  servings: 2,
  note: null,
  eaten_at: null,
  created_at: '2026-06-26T10:00:00Z',
  recipes: { title: 'Roast Chicken' },
  ...over,
})

beforeEach(() => {
  holder.rows = []
})

describe('getWeekPlan', () => {
  it('leaves meals marked eaten off the plan', async () => {
    holder.rows = [row({}), row({ id: 'e2', eaten_at: '2026-06-29T19:30:00Z', recipes: { title: 'Soup' } })]
    const plan = await getWeekPlan('2026-06-29')
    expect(plan.map((e) => e.id)).toEqual(['e1'])
    expect(plan[0].recipe_title).toBe('Roast Chicken')
  })

  it('still shows the plan on a database without the eaten_at column yet', async () => {
    // A row as it comes back before the migration: no eaten_at at all.
    const premigration = row({})
    delete premigration.eaten_at
    holder.rows = [premigration]
    expect((await getWeekPlan('2026-06-29')).map((e) => e.id)).toEqual(['e1'])
  })
})
