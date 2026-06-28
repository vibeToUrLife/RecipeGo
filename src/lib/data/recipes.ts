import 'server-only'
import { createClient } from '@/utils/supabase/server'
import type { Recipe, RecipeWithChildren, RecipeFormData } from '@/lib/db-types'

export async function listRecipes(roomId: string | null = null): Promise<Recipe[]> {
  const supabase = await createClient()
  let q = supabase.from('recipes').select('*').order('created_at', { ascending: false })
  q = roomId ? q.eq('room_id', roomId) : q.is('room_id', null)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function getRecipe(id: string): Promise<RecipeWithChildren | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('recipes')
    .select('*, ingredients(*), steps(*)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const r = data as RecipeWithChildren
  r.ingredients = (r.ingredients ?? []).sort((a, b) => a.position - b.position)
  r.steps = (r.steps ?? []).sort((a, b) => a.step_number - b.step_number)
  return r
}

async function insertChildren(recipeId: string, input: RecipeFormData) {
  const supabase = await createClient()
  if (input.ingredients.length) {
    const { error } = await supabase.from('ingredients').insert(
      input.ingredients.map((ing) => ({ ...ing, recipe_id: recipeId })),
    )
    if (error) throw error
  }
  if (input.steps.length) {
    const { error } = await supabase.from('steps').insert(
      input.steps.map((s) => ({ ...s, recipe_id: recipeId })),
    )
    if (error) throw error
  }
}

export async function createRecipe(input: RecipeFormData): Promise<string> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('recipes')
    .insert({
      title: input.title,
      description: input.description,
      servings: input.servings,
      prep_minutes: input.prep_minutes,
      cook_minutes: input.cook_minutes,
      difficulty: input.difficulty,
      source_url: input.source_url,
      image_path: input.image_path,
      room_id: input.room_id,
    })
    .select('id')
    .single()
  if (error) throw error
  await insertChildren(data.id, input)
  return data.id
}

export async function updateRecipe(id: string, input: RecipeFormData): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('recipes')
    .update({
      title: input.title,
      description: input.description,
      servings: input.servings,
      prep_minutes: input.prep_minutes,
      cook_minutes: input.cook_minutes,
      difficulty: input.difficulty,
      source_url: input.source_url,
      image_path: input.image_path,
      room_id: input.room_id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error
  // replace children
  await (await createClient()).from('ingredients').delete().eq('recipe_id', id)
  await (await createClient()).from('steps').delete().eq('recipe_id', id)
  await insertChildren(id, input)
}

export async function deleteRecipe(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('recipes').delete().eq('id', id)
  if (error) throw error
}
