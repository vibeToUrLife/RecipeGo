'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createRecipe, updateRecipe, deleteRecipe } from '@/lib/data/recipes'
import { categorizeIngredient } from '@/lib/aisles'
import type { RecipeFormData } from '@/lib/db-types'

function parseForm(formData: FormData): RecipeFormData {
  const names = formData.getAll('ing_name') as string[]
  const qtys = formData.getAll('ing_qty') as string[]
  const ingredients = names
    .map((name, i) => ({
      name: name.trim(),
      quantity: qtys[i] ? Number(qtys[i]) : null,
      unit: null,
      category: categorizeIngredient(name),
      position: i,
    }))
    .filter((ing) => ing.name.length > 0)

  // step_text and step_image are emitted once per row, so they stay index-aligned.
  const stepTexts = formData.getAll('step_text') as string[]
  const stepImages = formData.getAll('step_image') as string[]
  const steps = stepTexts
    .map((t, i) => ({ text: t.trim(), image_path: stepImages[i] || null }))
    .filter((s) => s.text.length > 0)
    .map((s, i) => ({ step_number: i + 1, text: s.text, image_path: s.image_path }))

  const num = (v: FormDataEntryValue | null) => (v ? Number(v) : null)
  return {
    title: (formData.get('title') as string).trim(),
    description: (formData.get('description') as string)?.trim() || null,
    servings: Number(formData.get('servings')) || 1,
    prep_minutes: num(formData.get('prep_minutes')),
    cook_minutes: num(formData.get('cook_minutes')),
    difficulty: (formData.get('difficulty') as RecipeFormData['difficulty']) || null,
    source_url: (formData.get('source_url') as string)?.trim() || null,
    image_path: (formData.get('image_path') as string) || null,
    room_id: (formData.get('room_id') as string) || null,
    ingredients,
    steps,
  }
}

export async function saveRecipe(formData: FormData) {
  const id = formData.get('id') as string | null
  const data = parseForm(formData)
  if (id) {
    await updateRecipe(id, data)
    revalidatePath(`/recipes/${id}`)
    redirect(`/recipes/${id}`)
  } else {
    const newId = await createRecipe(data)
    revalidatePath('/')
    redirect(`/recipes/${newId}`)
  }
}

export async function removeRecipe(id: string) {
  await deleteRecipe(id)
  revalidatePath('/')
  redirect('/')
}
