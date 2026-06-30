'use server'
import { revalidatePath } from 'next/cache'
import {
  addRecipeToList,
  setItemChecked,
  removeItem,
  addShoppingItem,
  completeShopping,
} from '@/lib/data/shopping'

export async function addToListAction(recipeId: string, servings: number) {
  await addRecipeToList(recipeId, servings)
  revalidatePath('/', 'layout')
}
export async function toggleItemAction(id: string, checked: boolean) {
  await setItemChecked(id, checked)
  revalidatePath('/', 'layout')
}
export async function removeItemAction(id: string) {
  await removeItem(id)
  revalidatePath('/', 'layout')
}
export async function addShoppingItemAction(
  roomId: string | null,
  name: string,
  isFood: boolean,
): Promise<{ ok?: true; error?: string }> {
  const clean = name?.trim() ?? ''
  if (!clean) return { error: 'Enter an item name.' }
  if (clean.length > 200) return { error: 'Name too long (max 200 characters).' }
  await addShoppingItem(clean, isFood, roomId)
  revalidatePath(roomId ? `/rooms/${roomId}/shopping-list` : '/shopping-list')
  return { ok: true }
}

export async function completeShoppingAction(roomId: string | null = null) {
  const result = await completeShopping(roomId)
  // shopping list changed, and the pantry (Ingredients) changed too
  revalidatePath('/', 'layout')
  return result
}
