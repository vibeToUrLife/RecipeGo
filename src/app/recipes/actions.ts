'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createRecipe, updateRecipe, deleteRecipe } from '@/lib/data/recipes'
import { categorizeIngredient } from '@/lib/aisles'
import type { RecipeFormData } from '@/lib/db-types'
import type { Unit } from '@/lib/types'

function parseForm(formData: FormData): RecipeFormData {
  const names = formData.getAll('ing_name') as string[]
  const qtys = formData.getAll('ing_qty') as string[]
  const units = formData.getAll('ing_unit') as string[]
  const ingredients = names
    .map((name, i) => ({
      name: name.trim(),
      quantity: qtys[i] ? Number(qtys[i]) : null,
      unit: (units[i] || null) as Unit,
      category: categorizeIngredient(name),
      position: i,
    }))
    .filter((ing) => ing.name.length > 0)

  const stepTexts = formData.getAll('step_text') as string[]
  const steps = stepTexts
    .map((t, i) => ({ step_number: i + 1, text: t.trim() }))
    .filter((s) => s.text.length > 0)

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
