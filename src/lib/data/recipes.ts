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

// All recipes the user can see (personal + rooms) with just their ingredient
// names — used by the "What can I cook?" planner. RLS scopes both queries.
export async function listRecipesWithIngredients(): Promise<
  { id: string; title: string; room_id: string | null; ingredients: string[] }[]
> {
  const supabase = await createClient()
  const { data: recipes, error } = await supabase.from('recipes').select('id, title, room_id')
  if (error) throw error
  const list = recipes ?? []
  if (list.length === 0) return []
  const { data: ings, error: iErr } = await supabase
    .from('ingredients')
    .select('recipe_id, name')
    .in('recipe_id', list.map((r) => r.id))
  if (iErr) throw iErr
  const byRecipe: Record<string, string[]> = {}
  for (const ing of ings ?? []) {
    ;(byRecipe[ing.recipe_id] ??= []).push(ing.name)
  }
  return list.map((r) => ({ id: r.id, title: r.title, room_id: r.room_id, ingredients: byRecipe[r.id] ?? [] }))
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
  const payload: Record<string, unknown> = {
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
  }
  if (input.room_id === null) {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) payload.user_id = user.id
  }
  const { error } = await supabase.from('recipes').update(payload).eq('id', id)
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
