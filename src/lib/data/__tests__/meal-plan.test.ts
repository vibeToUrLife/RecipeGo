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
import { getWeekPlan, addWeekToShoppingList } from '@/lib/data/meal-plan'
import { addRecipeToList } from '@/lib/data/shopping'

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
const eaten = { eaten_at: '2026-06-29T19:30:00Z' }

beforeEach(() => {
  holder.rows = []
  vi.mocked(addRecipeToList).mockReset()
})

describe('getWeekPlan', () => {
  it('keeps meals ticked as eaten on the plan', async () => {
    holder.rows = [row({}), row({ id: 'e2', recipes: { title: 'Soup' }, ...eaten })]
    const plan = await getWeekPlan('2026-06-29')
    expect(plan.map((e) => [e.id, e.recipe_title, e.eaten_at])).toEqual([
      ['e1', 'Roast Chicken', null],
      ['e2', 'Soup', '2026-06-29T19:30:00Z'],
    ])
  })
})

describe('addWeekToShoppingList', () => {
  it('adds only the meals not eaten yet', async () => {
    holder.rows = [
      row({ id: 'e1', recipe_id: 'r1', servings: 2 }),
      row({ id: 'e2', recipe_id: 'r2', servings: 4, ...eaten }),
    ]
    expect(await addWeekToShoppingList('2026-06-29')).toEqual({ meals: 1 })
    expect(addRecipeToList).toHaveBeenCalledTimes(1)
    expect(addRecipeToList).toHaveBeenCalledWith('r1', 2)
  })

  it('adds every meal on a database without the eaten_at column yet', async () => {
    // Rows as they come back before the migration: no eaten_at at all.
    holder.rows = [row({ id: 'e1', recipe_id: 'r1' }), row({ id: 'e2', recipe_id: 'r2' })]
    for (const r of holder.rows) delete r.eaten_at
    expect(await addWeekToShoppingList('2026-06-29')).toEqual({ meals: 2 })
    expect(addRecipeToList).toHaveBeenCalledTimes(2)
  })
})
