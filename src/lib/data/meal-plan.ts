import 'server-only'
import { createClient } from '@/utils/supabase/server'
import { addRecipeToList } from '@/lib/data/shopping'
import { weekDays, fromISODate, toISODate, addWeeks, type MealSlot } from '@/lib/plan/week'
import type { MealPlanEntryView } from '@/lib/db-types'

export async function getWeekPlan(
  weekStartISO: string,
  roomId: string | null = null,
): Promise<MealPlanEntryView[]> {
  const supabase = await createClient()
  const days = weekDays(fromISODate(weekStartISO)).map(toISODate)
  let q = supabase
    .from('meal_plan_entries')
    .select('*, recipes(title)')
    .gte('plan_date', days[0])
    .lte('plan_date', days[days.length - 1])
    .order('plan_date', { ascending: true })
  q = roomId ? q.eq('room_id', roomId) : q.is('room_id', null)
  const { data, error } = await q
  if (error) throw error
  type Row = Omit<MealPlanEntryView, 'recipe_title'> & { recipes: { title: string } | null }
  return ((data ?? []) as Row[]).map(({ recipes, ...rest }) => ({
    ...rest,
    recipe_title: recipes?.title ?? '',
  }))
}

export async function addPlanEntry(input: {
  recipeId: string
  planDate: string
  slot: MealSlot
  servings: number
  roomId: string | null
  note: string | null
}): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('meal_plan_entries').insert({
    recipe_id: input.recipeId,
    plan_date: input.planDate,
    meal_slot: input.slot,
    servings: input.servings,
    room_id: input.roomId,
    note: input.note,
  })
  if (error) throw error
}

export async function updatePlanServings(id: string, servings: number): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('meal_plan_entries').update({ servings }).eq('id', id)
  if (error) throw error
}

// Set (or clear, with null) the note on a planned meal.
export async function updatePlanNote(id: string, note: string | null): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('meal_plan_entries').update({ note }).eq('id', id)
  if (error) throw error
}

// Move an entry to a different day and/or meal slot.
export async function movePlanEntry(
  id: string,
  planDate: string,
  slot: MealSlot,
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('meal_plan_entries')
    .update({ plan_date: planDate, meal_slot: slot })
    .eq('id', id)
  if (error) throw error
}

// Tick a planned meal as eaten (stamped with when), or untick it. It stays on
// the plan either way.
export async function setPlanEntryEaten(id: string, eaten: boolean): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('meal_plan_entries')
    .update({ eaten_at: eaten ? new Date().toISOString() : null })
    .eq('id', id)
  if (error) throw error
}

export async function removePlanEntry(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('meal_plan_entries').delete().eq('id', id)
  if (error) throw error
}

export async function removePlanEntries(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const supabase = await createClient()
  const { error } = await supabase.from('meal_plan_entries').delete().in('id', ids)
  if (error) throw error
}

// The week before onto the same days and meals of this one, as new meals with
// the same servings and notes, none of them eaten yet. One this week already
// has (the same recipe on the same day and meal) is left out, so copying twice
// adds nothing. `found` is how many meals the week before had; `ids` are the
// new ones, for an Undo.
export async function copyPreviousWeek(
  weekStartISO: string,
  roomId: string | null = null,
): Promise<{ found: number; ids: string[] }> {
  const weekStart = fromISODate(weekStartISO)
  const [before, current] = await Promise.all([
    getWeekPlan(toISODate(addWeeks(weekStart, -1)), roomId),
    getWeekPlan(weekStartISO, roomId),
  ])
  const key = (date: string, slot: string, recipeId: string) => `${date} ${slot} ${recipeId}`
  const have = new Set(current.map((e) => key(e.plan_date, e.meal_slot, e.recipe_id)))
  const rows = before
    .map((e) => ({
      recipe_id: e.recipe_id,
      plan_date: toISODate(addWeeks(fromISODate(e.plan_date), 1)),
      meal_slot: e.meal_slot,
      servings: e.servings,
      room_id: roomId,
      note: e.note,
    }))
    .filter((r) => !have.has(key(r.plan_date, r.meal_slot, r.recipe_id)))
  if (rows.length === 0) return { found: before.length, ids: [] }
  const supabase = await createClient()
  const { data, error } = await supabase.from('meal_plan_entries').insert(rows).select('id')
  if (error) throw error
  return { found: before.length, ids: (data ?? []).map((r: { id: string }) => r.id) }
}

// Push every planned meal in the week that hasn't been eaten yet into the
// shopping list. addRecipeToList derives the scope (personal vs room) from each
// recipe's own room_id and re-merges the unchecked food rows, so we call it
// sequentially per entry.
export async function addWeekToShoppingList(
  weekStartISO: string,
  roomId: string | null = null,
): Promise<{ meals: number }> {
  // A meal ticked as eaten has nothing left to buy. Rows from a database without
  // the eaten_at column yet have no stamp, so they all count.
  const entries = (await getWeekPlan(weekStartISO, roomId)).filter((e) => !e.eaten_at)
  for (const e of entries) {
    await addRecipeToList(e.recipe_id, e.servings)
  }
  return { meals: entries.length }
}
