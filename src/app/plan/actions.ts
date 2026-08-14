'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import {
  addPlanEntry,
  updatePlanServings,
  updatePlanNote,
  movePlanEntry,
  removePlanEntry,
  addWeekToShoppingList,
} from '@/lib/data/meal-plan'
import { getRecipe } from '@/lib/data/recipes'
import { MEAL_SLOTS, type MealSlot } from '@/lib/plan/week'
import { cleanNote, NOTE_MAX } from '@/lib/plan/note'
import type { RecipeWithChildren } from '@/lib/db-types'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// A rejected write used to escape these actions and land in the root error
// boundary, so one meal that failed to save replaced the whole planner with the
// "Something went wrong" screen. Every other write in the app reports failure as
// a toast and leaves the page standing; these now do the same. The cause still
// reaches the server log, where it belongs.
async function write(run: () => Promise<void>): Promise<{ ok?: true; error?: string }> {
  try {
    await run()
  } catch (e) {
    console.error(e)
    return { error: 'Could not update your plan. Please try again.' }
  }
  revalidatePath('/', 'layout')
  return { ok: true }
}

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
  note?: string | null
}): Promise<{ ok?: true; error?: string }> {
  if (!input?.recipeId) return { error: 'Missing recipe.' }
  if (!ISO_DATE.test(input?.planDate ?? '')) return { error: 'Invalid date.' }
  if (!MEAL_SLOTS.includes(input?.slot as MealSlot)) return { error: 'Invalid meal.' }
  const servings = cleanServings(input?.servings)
  if (servings === null) return { error: 'Enter a valid number of people (1–1000).' }
  const note = cleanNote(input?.note)
  if (note === undefined) return { error: `Note too long (max ${NOTE_MAX} characters).` }
  return write(() =>
    addPlanEntry({
      recipeId: input.recipeId,
      planDate: input.planDate,
      slot: input.slot as MealSlot,
      servings,
      roomId: input.roomId ?? null,
      note,
    }),
  )
}

export async function updatePlanNoteAction(
  id: string,
  note: string | null,
): Promise<{ ok?: true; error?: string }> {
  const clean = cleanNote(note)
  if (clean === undefined) return { error: `Note too long (max ${NOTE_MAX} characters).` }
  return write(() => updatePlanNote(id, clean))
}

export async function updatePlanServingsAction(
  id: string,
  servings: number,
): Promise<{ ok?: true; error?: string }> {
  const v = cleanServings(servings)
  if (v === null) return { error: 'Enter a valid number of people (1–1000).' }
  return write(() => updatePlanServings(id, v))
}

export async function movePlanEntryAction(
  id: string,
  planDate: string,
  slot: string,
): Promise<{ ok?: true; error?: string }> {
  if (!ISO_DATE.test(planDate ?? '')) return { error: 'Invalid date.' }
  if (!MEAL_SLOTS.includes(slot as MealSlot)) return { error: 'Invalid meal.' }
  return write(() => movePlanEntry(id, planDate, slot as MealSlot))
}

export async function removePlanEntryAction(
  id: string,
): Promise<{ ok?: true; error?: string }> {
  return write(() => removePlanEntry(id))
}

export async function addWeekToShoppingListAction(
  weekStartISO: string,
  roomId: string | null = null,
): Promise<{ meals?: number; error?: string }> {
  try {
    const result = await addWeekToShoppingList(weekStartISO, roomId)
    revalidatePath('/', 'layout')
    return result
  } catch (e) {
    console.error(e)
    // The meals are pushed one at a time, so an earlier one may already be on
    // the list — refresh regardless of where it stopped.
    revalidatePath('/', 'layout')
    return { error: 'Could not add the week to your shopping list. Please try again.' }
  }
}

// Full recipe (with ingredients + steps) for the "view recipe" modal reachable
// from a planned meal. RLS scopes the read; a missing/forbidden id returns null.
export async function getPlannedRecipeAction(
  recipeId: string,
): Promise<RecipeWithChildren | null> {
  if (!recipeId) return null
  return getRecipe(recipeId)
}

export async function setWeekStartAction(
  weekStartsOn: number,
): Promise<{ ok?: true; error?: string }> {
  if (!Number.isInteger(weekStartsOn) || weekStartsOn < 0 || weekStartsOn > 6) {
    return { error: 'Invalid day.' }
  }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in.' }
  const { error } = await supabase
    .from('profiles')
    .update({ week_starts_on: weekStartsOn })
    .eq('id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return { ok: true }
}
