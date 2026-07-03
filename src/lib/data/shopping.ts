import 'server-only'
import { createClient } from '@/utils/supabase/server'
import { getRecipe } from '@/lib/data/recipes'
import { addPantryItem } from '@/lib/data/pantry'
import { scaleIngredients } from '@/lib/scaling'
import { mergeIngredients } from '@/lib/merge'
import { findStackTarget, stackedTotal } from '@/lib/stack'
import { AISLE_ORDER, categorizeIngredient } from '@/lib/aisles'
import type { IngredientInput, Aisle, Unit } from '@/lib/types'

export interface ShoppingListRow {
  id: string
  name: string
  total_quantity: number | null
  unit: Unit
  category: Aisle
  checked: boolean
  source_recipe_ids: string[]
  is_food: boolean
  room_id: string | null
}

export async function getShoppingList(roomId: string | null = null): Promise<ShoppingListRow[]> {
  const supabase = await createClient()
  let q = supabase.from('shopping_list_items').select('*')
  q = roomId ? q.eq('room_id', roomId) : q.is('room_id', null)
  const { data, error } = await q
  if (error) throw error
  const rows = (data ?? []) as ShoppingListRow[]
  return rows.sort((a, b) => {
    const ai = AISLE_ORDER.indexOf(a.category), bi = AISLE_ORDER.indexOf(b.category)
    return ai !== bi ? ai - bi : a.name.localeCompare(b.name)
  })
}

export async function addRecipeToList(recipeId: string, servings: number): Promise<void> {
  const supabase = await createClient()
  const recipe = await getRecipe(recipeId)
  if (!recipe) throw new Error('Recipe not found')

  const roomId = recipe.room_id  // null = personal

  const base: IngredientInput[] = recipe.ingredients.map((i) => ({
    name: i.name, quantity: i.quantity, unit: i.unit, category: i.category,
  }))
  const scaled = scaleIngredients(base, recipe.servings, servings)

  // Merge new ingredients with existing UNCHECKED *food* rows so duplicates
  // combine. Non-food (daily) rows and checked rows are never touched here.
  const existingQ = supabase.from('shopping_list_items').select('*').eq('checked', false).eq('is_food', true)
  const { data: existing } = await (roomId ? existingQ.eq('room_id', roomId) : existingQ.is('room_id', null))
  const existingRows = (existing ?? []) as ShoppingListRow[]

  const combined = [
    ...existingRows.map((r) => ({
      name: r.name, quantity: r.total_quantity, unit: r.unit, category: r.category,
      recipeId: r.source_recipe_ids[0] ?? recipeId,
    })),
    ...scaled.map((i) => ({ ...i, recipeId })),
  ]
  const merged = mergeIngredients(combined)

  // Replace unchecked FOOD rows with the merged set (checked rows and non-food
  // daily rows are left alone).
  const delQ = supabase.from('shopping_list_items').delete().eq('checked', false).eq('is_food', true)
  const { error: delError } = await (roomId ? delQ.eq('room_id', roomId) : delQ.is('room_id', null))
  if (delError) throw delError
  if (merged.length) {
    const { error: insError } = await supabase.from('shopping_list_items').insert(
      merged.map((m) => ({
        name: m.name, total_quantity: m.totalQuantity, unit: m.unit,
        category: m.category, source_recipe_ids: m.sourceRecipeIds, checked: false, is_food: true, room_id: roomId,
      })),
    )
    if (insError) throw insError
  }
}

// Manually add an extra item (food or non-food "daily") to the list, with an
// optional quantity + unit.
export async function addShoppingItem(input: {
  name: string
  isFood: boolean
  quantity: number | null
  unit: Unit
  roomId: string | null
}): Promise<void> {
  const supabase = await createClient()
  const clean = input.name.trim()

  // Try to stack onto an existing UNCHECKED row of the same kind (food/daily)
  // and name in the same list, so re-adding e.g. "鸡腿 3" combines with the
  // earlier one instead of creating a separate duplicate line. Checked rows are
  // left alone (they belong to the trip in progress).
  const existingQ = supabase.from('shopping_list_items').select('*').eq('checked', false).eq('is_food', input.isFood)
  const { data: existing, error: selError } = await (input.roomId
    ? existingQ.eq('room_id', input.roomId)
    : existingQ.is('room_id', null))
  if (selError) throw selError

  const rows = (existing ?? []) as ShoppingListRow[]
  const added = { name: clean, unit: input.unit, quantity: input.quantity }
  const idx = findStackTarget(
    rows.map((r) => ({ name: r.name, unit: r.unit, totalQuantity: r.total_quantity })),
    added,
  )

  if (idx !== -1) {
    const match = rows[idx]
    const total = stackedTotal({ name: match.name, unit: match.unit, totalQuantity: match.total_quantity }, added)
    const { error } = await supabase
      .from('shopping_list_items')
      .update({ total_quantity: total })
      .eq('id', match.id)
    if (error) throw error
    return
  }

  const { error } = await supabase.from('shopping_list_items').insert({
    name: clean,
    total_quantity: input.quantity,
    unit: input.unit,
    category: input.isFood ? categorizeIngredient(clean) : 'Other',
    checked: false,
    source_recipe_ids: [],
    is_food: input.isFood,
    room_id: input.roomId,
  })
  if (error) throw error
}

// Finish a shopping trip: save the ticked FOOD items to the pantry (Ingredients),
// then remove all ticked items. Returns how many were saved/cleared.
export async function completeShopping(
  roomId: string | null = null,
): Promise<{ saved: number; cleared: number }> {
  const supabase = await createClient()
  let q = supabase.from('shopping_list_items').select('name, is_food').eq('checked', true)
  q = roomId ? q.eq('room_id', roomId) : q.is('room_id', null)
  const { data, error } = await q
  if (error) throw error
  const rows = (data ?? []) as { name: string; is_food: boolean }[]

  // Dedupe food names (case-insensitively) so the saved count is accurate.
  const foods = [...new Set(rows.filter((r) => r.is_food).map((r) => r.name.trim().toLowerCase()))]
  for (const name of foods) await addPantryItem(name)

  const delQ = supabase.from('shopping_list_items').delete().eq('checked', true)
  const { error: delErr } = await (roomId ? delQ.eq('room_id', roomId) : delQ.is('room_id', null))
  if (delErr) throw delErr

  return { saved: foods.length, cleared: rows.length }
}

export async function setItemChecked(id: string, checked: boolean): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('shopping_list_items').update({ checked }).eq('id', id)
  if (error) throw error
}

// Adjust the quantity of an item already on the list. A null quantity means
// "unspecified" (the amount is hidden); the unit is left unchanged.
export async function setItemQuantity(id: string, quantity: number | null): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('shopping_list_items').update({ total_quantity: quantity }).eq('id', id)
  if (error) throw error
}

export async function removeItem(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('shopping_list_items').delete().eq('id', id)
  if (error) throw error
}
