import { describe, it, expect, vi, beforeEach } from 'vitest'

// meal-plan.ts imports 'server-only' (a build-time guard against client bundling);
// neutralize it under the jsdom test environment.
vi.mock('server-only', () => ({}))

const holder = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  // A week's rows by its first day, where a test needs two weeks to differ.
  weeks: {} as Record<string, Record<string, unknown>[]>,
  inserted: [] as Record<string, unknown>[],
}))
// The week's query as getWeekPlan builds it, ending in the scope filter; and
// an insert, which hands back an id for each row.
vi.mock('@/utils/supabase/server', () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({
        gte: (_column: string, first: string) => {
          const rows = () => Promise.resolve({ data: holder.weeks[first] ?? holder.rows, error: null })
          return { lte: () => ({ order: () => ({ eq: rows, is: rows }) }) }
        },
      }),
      insert: (rows: Record<string, unknown>[]) => {
        holder.inserted.push(...rows)
        return { select: async () => ({ data: rows.map((_, i) => ({ id: `new${i}` })), error: null }) }
      },
    }),
  }),
}))
vi.mock('@/lib/data/shopping', () => ({ addRecipeToList: vi.fn() }))
import { getWeekPlan, addWeekToShoppingList, copyPreviousWeek } from '@/lib/data/meal-plan'
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
  holder.weeks = {}
  holder.inserted = []
  vi.mocked(addRecipeToList).mockReset()
})

describe('copyPreviousWeek', () => {
  // Monday 22 June, the week before Monday 29 June.
  const lastWeek = () => [
    row({ id: 'a', plan_date: '2026-06-22', meal_slot: 'dinner', recipe_id: 'r1', servings: 3, note: 'extra spicy', ...eaten }),
    row({ id: 'b', plan_date: '2026-06-24', meal_slot: 'lunch', recipe_id: 'r2' }),
  ]

  it('puts last week’s meals on the same days and meals, not eaten yet', async () => {
    holder.weeks = { '2026-06-22': lastWeek(), '2026-06-29': [] }
    expect(await copyPreviousWeek('2026-06-29', 'room-1')).toEqual({ found: 2, ids: ['new0', 'new1'] })
    expect(holder.inserted).toEqual([
      { recipe_id: 'r1', plan_date: '2026-06-29', meal_slot: 'dinner', servings: 3, room_id: 'room-1', note: 'extra spicy' },
      { recipe_id: 'r2', plan_date: '2026-07-01', meal_slot: 'lunch', servings: 2, room_id: 'room-1', note: null },
    ])
  })

  it('leaves out a meal this week already has, so copying twice adds nothing', async () => {
    holder.weeks = {
      '2026-06-22': lastWeek(),
      '2026-06-29': [row({ id: 'c', plan_date: '2026-06-29', meal_slot: 'dinner', recipe_id: 'r1' })],
    }
    expect(await copyPreviousWeek('2026-06-29')).toEqual({ found: 2, ids: ['new0'] })
    expect(holder.inserted.map((r) => r.recipe_id)).toEqual(['r2'])
  })

  it('adds nothing when nothing was planned the week before', async () => {
    holder.weeks = { '2026-06-22': [], '2026-06-29': [] }
    expect(await copyPreviousWeek('2026-06-29')).toEqual({ found: 0, ids: [] })
    expect(holder.inserted).toEqual([])
  })
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
