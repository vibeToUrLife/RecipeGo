'use server'
import { revalidatePath } from 'next/cache'
import {
  addPlanEntry,
  updatePlanServings,
  movePlanEntry,
  removePlanEntry,
  addWeekToShoppingList,
} from '@/lib/data/meal-plan'
import { MEAL_SLOTS, type MealSlot } from '@/lib/plan/week'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function cleanServings(n: unknown): number | null {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null
  const v = Math.round(n)
  return v >= 1 && v <= 1000 ? v : null
}

export async function addPlanEntryAction(input: {
  recipeId: string
  planDate: string
  slot: string
  servings: number
  roomId: string | null
}): Promise<{ ok?: true; error?: string }> {
  if (!input?.recipeId) return { error: 'Missing recipe.' }
  if (!ISO_DATE.test(input?.planDate ?? '')) return { error: 'Invalid date.' }
  if (!MEAL_SLOTS.includes(input?.slot as MealSlot)) return { error: 'Invalid meal.' }
  const servings = cleanServings(input?.servings)
  if (servings === null) return { error: 'Enter a valid number of people (1–1000).' }
  await addPlanEntry({
    recipeId: input.recipeId,
    planDate: input.planDate,
    slot: input.slot as MealSlot,
    servings,
    roomId: input.roomId ?? null,
  })
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function updatePlanServingsAction(
  id: string,
  servings: number,
): Promise<{ ok?: true; error?: string }> {
  const v = cleanServings(servings)
  if (v === null) return { error: 'Enter a valid number of people (1–1000).' }
  await updatePlanServings(id, v)
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function movePlanEntryAction(
  id: string,
  planDate: string,
  slot: string,
): Promise<{ ok?: true; error?: string }> {
  if (!ISO_DATE.test(planDate ?? '')) return { error: 'Invalid date.' }
  if (!MEAL_SLOTS.includes(slot as MealSlot)) return { error: 'Invalid meal.' }
  await movePlanEntry(id, planDate, slot as MealSlot)
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function removePlanEntryAction(id: string) {
  await removePlanEntry(id)
  revalidatePath('/', 'layout')
}

export async function addWeekToShoppingListAction(
  weekStartISO: string,
  roomId: string | null = null,
): Promise<{ meals: number }> {
  const result = await addWeekToShoppingList(weekStartISO, roomId)
  revalidatePath('/', 'layout')
  return result
}
