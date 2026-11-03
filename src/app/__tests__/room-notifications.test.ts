import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/push/send', () => ({ notifyRoom: vi.fn(), pushConfigured: vi.fn(() => true) }))
vi.mock('@/utils/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/data/recipes', () => ({ getRecipe: vi.fn() }))
vi.mock('@/lib/data/shopping', () => ({
  addRecipeToList: vi.fn(),
  addShoppingItem: vi.fn(),
  completeShopping: vi.fn(),
  clearShoppingList: vi.fn(),
  setItemChecked: vi.fn(),
  setItemQuantity: vi.fn(),
  setItemName: vi.fn(),
  removeItem: vi.fn(),
}))
vi.mock('@/lib/data/meal-plan', () => ({
  addPlanEntry: vi.fn(),
  updatePlanServings: vi.fn(),
  updatePlanNote: vi.fn(),
  movePlanEntry: vi.fn(),
  setPlanEntryEaten: vi.fn(),
  removePlanEntry: vi.fn(),
  removePlanEntries: vi.fn(),
  copyPreviousWeek: vi.fn(),
  addWeekToShoppingList: vi.fn(),
  getPlanEntryForNotice: vi.fn(),
  getRecipeTitle: vi.fn(),
}))

import { notifyRoom, pushConfigured } from '@/lib/push/send'
import { addRecipeToList, completeShopping } from '@/lib/data/shopping'
import {
  addPlanEntry,
  addWeekToShoppingList,
  copyPreviousWeek,
  getPlanEntryForNotice,
  getRecipeTitle,
  removePlanEntry,
} from '@/lib/data/meal-plan'
import {
  addShoppingItemAction,
  addToListAction,
  clearShoppingListAction,
  completeShoppingAction,
  removeItemAction,
  toggleItemAction,
} from '@/app/shopping-list/actions'
import {
  addPlanEntryAction,
  addWeekToShoppingListAction,
  copyLastWeekAction,
  movePlanEntryAction,
  removePlanEntryAction,
  setPlanEntryEatenAction,
  updatePlanServingsAction,
} from '@/app/plan/actions'

const told = () => vi.mocked(notifyRoom).mock.calls.map(([what]) => what)
// notifyRoom given a function works out what to say later; this is what it says.
async function said(i = 0) {
  const what = told()[i]
  return typeof what === 'function' ? what() : what
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(pushConfigured).mockReturnValue(true)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('the shopping list tells the room', () => {
  it('when an item is added to a room’s list', async () => {
    await addShoppingItemAction('r1', { name: ' eggs ', isFood: true, quantity: null, unit: null })
    expect(told()).toEqual([{ roomId: 'r1', change: { kind: 'listItem', item: 'eggs' } }])
  })

  it('when a room recipe’s ingredients go on the list', async () => {
    vi.mocked(addRecipeToList).mockResolvedValue({ roomId: 'r1', title: 'Mapo tofu' })
    await addToListAction('rec1', 4)
    expect(told()).toEqual([{ roomId: 'r1', change: { kind: 'listRecipe', recipe: 'Mapo tofu' } }])
  })

  it('when the shop is done, with how many items were bought', async () => {
    vi.mocked(completeShopping).mockResolvedValue({ saved: 3, cleared: 5 })
    await completeShoppingAction('r1')
    expect(told()).toEqual([{ roomId: 'r1', change: { kind: 'listDone', n: 5 } }])
  })

  it('and passes your own list on too, where notifyRoom tells no one', async () => {
    await addShoppingItemAction(null, { name: 'eggs', isFood: true, quantity: null, unit: null })
    expect(told()).toEqual([{ roomId: null, change: { kind: 'listItem', item: 'eggs' } }])
  })

  it('but not for a tick, a removal, clearing the list, or finishing with nothing ticked', async () => {
    await toggleItemAction('it1', true)
    await removeItemAction('it1')
    await clearShoppingListAction('r1')
    vi.mocked(completeShopping).mockResolvedValue({ saved: 0, cleared: 0 })
    await completeShoppingAction('r1')
    expect(notifyRoom).not.toHaveBeenCalled()
  })

  it('nor for an item that wasn’t added', async () => {
    await addShoppingItemAction('r1', { name: '   ', isFood: true, quantity: null, unit: null })
    expect(notifyRoom).not.toHaveBeenCalled()
  })
})

describe('the plan tells the room', () => {
  const meal = { recipeId: 'rec1', planDate: '2026-11-03', slot: 'dinner', servings: 2, roomId: 'r1' }

  it('when a meal is planned, named once the response has gone', async () => {
    vi.mocked(getRecipeTitle).mockResolvedValue('Mapo tofu')
    await addPlanEntryAction(meal)
    expect(getRecipeTitle).not.toHaveBeenCalled()
    expect(await said()).toEqual({ roomId: 'r1', change: { kind: 'planAdded', recipe: 'Mapo tofu', date: '2026-11-03', slot: 'dinner' } })
  })

  it('not for a meal on your own plan, or one that failed to save', async () => {
    await addPlanEntryAction({ ...meal, roomId: null })
    vi.mocked(addPlanEntry).mockRejectedValueOnce(new Error('db down'))
    await addPlanEntryAction(meal)
    expect(notifyRoom).not.toHaveBeenCalled()
  })

  it('when a meal moves', async () => {
    vi.mocked(getPlanEntryForNotice).mockResolvedValue({ roomId: 'r1', recipe: 'Mapo tofu', date: '2026-11-03', slot: 'dinner' })
    await movePlanEntryAction('m1', '2026-11-05', 'lunch')
    expect(await said()).toEqual({ roomId: 'r1', change: { kind: 'planMoved', recipe: 'Mapo tofu', date: '2026-11-05', slot: 'lunch' } })
  })

  it('when a meal is taken off, looked up before it’s gone', async () => {
    vi.mocked(getPlanEntryForNotice).mockResolvedValue({ roomId: 'r1', recipe: 'Congee', date: '2026-11-08', slot: 'breakfast' })
    await removePlanEntryAction('m1')
    expect(vi.mocked(getPlanEntryForNotice).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(removePlanEntry).mock.invocationCallOrder[0])
    expect(told()).toEqual([{ roomId: 'r1', change: { kind: 'planRemoved', recipe: 'Congee', date: '2026-11-08', slot: 'breakfast' } }])
  })

  it('without the lookup when notifications aren’t set up', async () => {
    vi.mocked(pushConfigured).mockReturnValue(false)
    await removePlanEntryAction('m1')
    expect(getPlanEntryForNotice).not.toHaveBeenCalled()
    expect(notifyRoom).not.toHaveBeenCalled()
    expect(removePlanEntry).toHaveBeenCalledWith('m1')
  })

  it('when last week is copied over, with how many meals came', async () => {
    vi.mocked(copyPreviousWeek).mockResolvedValue({ found: 5, ids: ['a', 'b', 'c'] })
    await copyLastWeekAction('2026-11-02', 'r1')
    expect(told()).toEqual([{ roomId: 'r1', change: { kind: 'planCopied', n: 3, week: '2026-11-02' } }])
  })

  it('not when copying brought nothing', async () => {
    vi.mocked(copyPreviousWeek).mockResolvedValue({ found: 5, ids: [] })
    await copyLastWeekAction('2026-11-02', 'r1')
    expect(notifyRoom).not.toHaveBeenCalled()
  })

  it('when the week’s meals go on the shopping list', async () => {
    vi.mocked(addWeekToShoppingList).mockResolvedValue({ meals: 4 })
    await addWeekToShoppingListAction('2026-11-02', 'r1')
    expect(told()).toEqual([{ roomId: 'r1', change: { kind: 'listWeek' } }])
  })

  it('but not for servings or ticking a meal as eaten', async () => {
    await updatePlanServingsAction('m1', 3)
    await setPlanEntryEatenAction('m1', true)
    expect(notifyRoom).not.toHaveBeenCalled()
  })
})
