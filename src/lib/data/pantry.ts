import 'server-only'
import { createClient } from '@/utils/supabase/server'
import { normalizeIng } from '@/lib/cook/match'

export async function listPantry(): Promise<string[]> {
  const s = await createClient()
  const { data, error } = await s.from('pantry_items').select('name')
  if (error) throw error
  return (data ?? []).map((r: { name: string }) => r.name)
}

export async function addPantryItem(name: string): Promise<void> {
  const s = await createClient()
  // user_id defaults to auth.uid() server-side; PK (user_id, name) dedupes.
  // Plain insert; ignore the unique-violation (23505) when re-adding the same item.
  const { error } = await s.from('pantry_items').insert({ name: normalizeIng(name) })
  if (error && error.code !== '23505') throw error
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
