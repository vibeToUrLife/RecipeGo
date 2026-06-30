'use server'
import { addPantryItem, removePantryItem } from '@/lib/data/pantry'

export async function setPantryItemAction(name: string, present: boolean) {
  const clean = name?.trim() ?? ''
  if (!clean || clean.length > 200) throw new Error('Invalid ingredient name')
  if (present) await addPantryItem(clean)
  else await removePantryItem(clean)
}
