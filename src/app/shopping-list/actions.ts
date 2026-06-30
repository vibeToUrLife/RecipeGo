'use server'
import { revalidatePath } from 'next/cache'
import {
  addRecipeToList,
  setItemChecked,
  removeItem,
  addShoppingItem,
  completeShopping,
} from '@/lib/data/shopping'
import type { Unit } from '@/lib/types'
import { VALID_UNITS } from '@/lib/unit-options'

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
  input: { name: string; isFood: boolean; quantity: number | null; unit: Unit },
): Promise<{ ok?: true; error?: string }> {
  const clean = input?.name?.trim() ?? ''
  if (!clean) return { error: 'Enter an item name.' }
  if (clean.length > 200) return { error: 'Name too long (max 200 characters).' }

  let quantity = input.quantity
  if (quantity != null) {
    if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity < 0 || quantity > 100000) {
      return { error: 'Enter a valid quantity.' }
    }
  } else {
    quantity = null
  }

  // Only accept a known unit; anything else (or none) stores no unit.
  const unit: Unit = input.unit && VALID_UNITS.includes(input.unit) ? input.unit : null
  const isFood = input.isFood === true // coerce — never trust a raw client value

  await addShoppingItem({ name: clean, isFood, quantity, unit, roomId })
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function completeShoppingAction(roomId: string | null = null) {
  const result = await completeShopping(roomId)
  // shopping list changed, and the pantry (Ingredients) changed too
  revalidatePath('/', 'layout')
  return result
}
