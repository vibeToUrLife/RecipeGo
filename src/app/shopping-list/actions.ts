'use server'
import { revalidatePath } from 'next/cache'
import { addRecipeToList, setItemChecked, removeItem, clearChecked } from '@/lib/data/shopping'

export async function addToListAction(recipeId: string, servings: number) {
  await addRecipeToList(recipeId, servings)
  revalidatePath('/shopping-list')
}
export async function toggleItemAction(id: string, checked: boolean) {
  await setItemChecked(id, checked)
  revalidatePath('/shopping-list')
}
export async function removeItemAction(id: string) {
  await removeItem(id)
  revalidatePath('/shopping-list')
}
export async function clearCheckedAction() {
  await clearChecked()
  revalidatePath('/shopping-list')
}
