'use server'
import { addPantryItem, removePantryItem, setPantryAmount } from '@/lib/data/pantry'

export async function setPantryItemAction(name: string, present: boolean) {
  const clean = name?.trim() ?? ''
  if (!clean || clean.length > 200) throw new Error('Invalid ingredient name')
  if (present) await addPantryItem(clean)
  else await removePantryItem(clean)
}

export async function setPantryAmountAction(name: string, amount: string) {
  const clean = name?.trim() ?? ''
  if (!clean || clean.length > 200) throw new Error('Invalid ingredient name')
  const amt = (amount ?? '').trim()
  if (amt.length > 100) throw new Error('Amount too long')
  await setPantryAmount(clean, amt || null)
}
