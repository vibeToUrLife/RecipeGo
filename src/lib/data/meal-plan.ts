import 'server-only'
import { createClient } from '@/utils/supabase/server'
import { addRecipeToList } from '@/lib/data/shopping'
import { weekDays, fromISODate, toISODate, type MealSlot } from '@/lib/plan/week'
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
}): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('meal_plan_entries').insert({
    recipe_id: input.recipeId,
    plan_date: input.planDate,
    meal_slot: input.slot,
    servings: input.servings,
    room_id: input.roomId,
  })
  if (error) throw error
}

export async function updatePlanServings(id: string, servings: number): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('meal_plan_entries').update({ servings }).eq('id', id)
  if (error) throw error
}

export async function removePlanEntry(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('meal_plan_entries').delete().eq('id', id)
  if (error) throw error
}

// Push every planned meal in the week into the shopping list. addRecipeToList
// derives the scope (personal vs room) from each recipe's own room_id and
// re-merges the unchecked food rows, so we call it sequentially per entry.
export async function addWeekToShoppingList(
  weekStartISO: string,
  roomId: string | null = null,
): Promise<{ meals: number }> {
  const entries = await getWeekPlan(weekStartISO, roomId)
  for (const e of entries) {
    await addRecipeToList(e.recipe_id, e.servings)
  }
  return { meals: entries.length }
}
