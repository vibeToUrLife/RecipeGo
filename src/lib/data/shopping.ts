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
}

export async function getShoppingList(): Promise<ShoppingListRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('shopping_list_items').select('*')
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

  const base: IngredientInput[] = recipe.ingredients.map((i) => ({
    name: i.name, quantity: i.quantity, unit: i.unit, category: i.category,
  }))
  const scaled = scaleIngredients(base, recipe.servings, servings)

  // Merge new ingredients with existing UNCHECKED rows so duplicates combine.
  const { data: existing } = await supabase
    .from('shopping_list_items').select('*').eq('checked', false)
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
  await supabase.from('shopping_list_items').delete().eq('checked', false)
  if (merged.length) {
    await supabase.from('shopping_list_items').insert(
      merged.map((m) => ({
        name: m.name, total_quantity: m.totalQuantity, unit: m.unit,
        category: m.category, source_recipe_ids: m.sourceRecipeIds, checked: false,
      })),
    )
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

export async function clearChecked(): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('shopping_list_items').delete().eq('checked', true)
  if (error) throw error
}
