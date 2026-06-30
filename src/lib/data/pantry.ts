import 'server-only'
import { createClient } from '@/utils/supabase/server'
import { normalizeIng } from '@/lib/cook/match'

export interface PantryItem {
  name: string
  amount: string | null
}

export async function listPantry(): Promise<PantryItem[]> {
  const s = await createClient()
  const { data, error } = await s.from('pantry_items').select('name, amount')
  if (error) throw error
  return (data ?? []) as PantryItem[]
}

export async function addPantryItem(name: string): Promise<void> {
  const s = await createClient()
  // user_id defaults to auth.uid() server-side; PK (user_id, name) dedupes.
  // Plain insert; ignore the unique-violation (23505) when re-adding the same
  // item (leaves any existing amount untouched).
  const { error } = await s.from('pantry_items').insert({ name: normalizeIng(name) })
  if (error && error.code !== '23505') throw error
}

// Add the item if needed and set/clear its free-text amount ("how much left").
export async function setPantryAmount(name: string, amount: string | null): Promise<void> {
  const s = await createClient()
  const { data: { user }, error: authError } = await s.auth.getUser()
  if (authError) throw authError
  if (!user) throw new Error('Not authenticated')
  const { error } = await s.from('pantry_items').upsert(
    { user_id: user.id, name: normalizeIng(name), amount: amount?.trim() || null },
    { onConflict: 'user_id,name' },
  )
  if (error) throw error
}

export async function removePantryItem(name: string): Promise<void> {
  const s = await createClient()
  const { data: { user }, error: authError } = await s.auth.getUser()
  if (authError) throw authError
  if (!user) throw new Error('Not authenticated')
  // Explicit user_id filter as defense in depth (RLS also scopes this).
  const { error } = await s.from('pantry_items').delete().eq('user_id', user.id).eq('name', normalizeIng(name))
  if (error) throw error
}
