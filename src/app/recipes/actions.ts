'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createRecipe, updateRecipe, deleteRecipe, getRecipe } from '@/lib/data/recipes'
import { categorizeIngredient } from '@/lib/aisles'
import { VALID_UNITS } from '@/lib/unit-options'
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
      unit: VALID_UNITS.includes(units[i] as NonNullable<Unit>) ? (units[i] as Unit) : null,
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
  // Look up the recipe's room BEFORE deleting, so we refresh the correct list
  // and return the user to where they were (the room, not personal recipes).
  const recipe = await getRecipe(id)
  const roomId = recipe?.room_id ?? null
  await deleteRecipe(id)
  revalidatePath(`/recipes/${id}`)
  if (roomId) {
    revalidatePath(`/rooms/${roomId}`)
    redirect(`/rooms/${roomId}`)
  } else {
    revalidatePath('/')
    redirect('/')
  }
}
