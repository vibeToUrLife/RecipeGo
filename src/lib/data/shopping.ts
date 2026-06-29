import 'server-only'
import { createClient } from '@/utils/supabase/server'
import { getRecipe } from '@/lib/data/recipes'
import { scaleIngredients } from '@/lib/scaling'
import { mergeIngredients } from '@/lib/merge'
import { AISLE_ORDER } from '@/lib/aisles'
import type { IngredientInput, Aisle, Unit } from '@/lib/types'

export interface ShoppingListRow {
  id: string
  name: string
  total_quantity: number | null
  unit: Unit
  category: Aisle
  checked: boolean
  source_recipe_ids: string[]
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

  // Merge new ingredients with existing UNCHECKED rows so duplicates combine.
  const existingQ = supabase.from('shopping_list_items').select('*').eq('checked', false)
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

  // Replace unchecked rows with the merged set (checked rows are left alone).
  const delQ = supabase.from('shopping_list_items').delete().eq('checked', false)
  const { error: delError } = await (roomId ? delQ.eq('room_id', roomId) : delQ.is('room_id', null))
  if (delError) throw delError
  if (merged.length) {
    const { error: insError } = await supabase.from('shopping_list_items').insert(
      merged.map((m) => ({
        name: m.name, total_quantity: m.totalQuantity, unit: m.unit,
        category: m.category, source_recipe_ids: m.sourceRecipeIds, checked: false, room_id: roomId,
      })),
    )
    if (insError) throw insError
  }
}

export async function setItemChecked(id: string, checked: boolean): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('shopping_list_items').update({ checked }).eq('id', id)
  if (error) throw error
}

export async function removeItem(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('shopping_list_items').delete().eq('id', id)
  if (error) throw error
}

export async function clearChecked(roomId: string | null = null): Promise<void> {
  const supabase = await createClient()
  const q = supabase.from('shopping_list_items').delete().eq('checked', true)
  const { error } = await (roomId ? q.eq('room_id', roomId) : q.is('room_id', null))
  if (error) throw error
}
