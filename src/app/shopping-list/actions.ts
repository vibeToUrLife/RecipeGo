'use server'
import { revalidatePath } from 'next/cache'
import { addRecipeToList, setItemChecked, removeItem, clearChecked } from '@/lib/data/shopping'

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
export async function clearCheckedAction(roomId: string | null = null) {
  await clearChecked(roomId)
  revalidatePath(roomId ? `/rooms/${roomId}/shopping-list` : '/shopping-list')
}
