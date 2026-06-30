import 'server-only'
import { createClient } from '@/utils/supabase/server'
import type { Room, RoomInvite, MemberWithName, PendingInvite } from '@/lib/db-types'
import { normalizeEmail } from '@/lib/email'

export async function listMyRooms(): Promise<Room[]> {
  const s = await createClient()
  const { data, error } = await s.from('rooms').select('*').order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function getRoom(id: string): Promise<Room | null> {
  const s = await createClient()
  const { data, error } = await s.from('rooms').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data ?? null
}

export async function createRoom(name: string): Promise<string> {
  const s = await createClient()
  const { data, error } = await s.from('rooms').insert({ name }).select('id').single()
  if (error) throw error
  return data.id
}

export async function renameRoom(id: string, name: string): Promise<void> {
  const s = await createClient()
  const { error } = await s.from('rooms').update({ name }).eq('id', id)
  if (error) throw error
}

export async function deleteRoom(id: string): Promise<void> {
  const s = await createClient()
  const { error } = await s.from('rooms').delete().eq('id', id)
  if (error) throw error
}

export async function listMembers(roomId: string): Promise<MemberWithName[]> {
  const s = await createClient()
  const { data: members, error } = await s.from('room_members').select('*').eq('room_id', roomId)
  if (error) throw error
  const ids = (members ?? []).map((m) => m.user_id)
  let names: Record<string, string | null> = {}
  if (ids.length) {
    const { data: profs, error: pErr } = await s.from('profiles').select('id, display_name').in('id', ids)
    if (pErr) throw pErr
    names = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.display_name]))
  }
  return (members ?? []).map((m: any) => ({ room_id: m.room_id, user_id: m.user_id, role: m.role, joined_at: m.joined_at, display_name: names[m.user_id] ?? null }))
}

export async function removeMember(roomId: string, userId: string): Promise<void> {
  const s = await createClient()
  const { error } = await s.from('room_members').delete().eq('room_id', roomId).eq('user_id', userId)
  if (error) throw error
}

export async function leaveRoom(roomId: string): Promise<void> {
  const s = await createClient()
  const { data: { user }, error: authError } = await s.auth.getUser()
  if (authError) throw authError
  if (!user) throw new Error('Not authenticated')
  const { error } = await s.from('room_members').delete().eq('room_id', roomId).eq('user_id', user.id)
  if (error) throw error
}

export async function inviteToRoom(roomId: string, email: string): Promise<void> {
  const s = await createClient()
  const { error } = await s.from('room_invites').upsert(
    { room_id: roomId, email: normalizeEmail(email), status: 'pending' },
    { onConflict: 'room_id,email' },
  )
  if (error) throw error
}

export async function listRoomInvites(roomId: string): Promise<RoomInvite[]> {
  const s = await createClient()
  const { data, error } = await s.from('room_invites').select('*').eq('room_id', roomId).eq('status', 'pending')
  if (error) throw error
  return data ?? []
}

export async function listMyPendingInvites(): Promise<PendingInvite[]> {
  // Uses the SECURITY DEFINER rpc so the room NAME is visible even though the
  // invitee is not yet a member (and thus cannot read public.rooms via RLS).
  const s = await createClient()
  const { data, error } = await s.rpc('my_pending_invites')
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    id: r.id,
    room_id: r.room_id,
    room_name: r.room_name,
    created_at: r.created_at,
  }))
}

export async function acceptInvite(inviteId: string): Promise<void> {
  const s = await createClient()
  const { error } = await s.rpc('accept_room_invite', { p_invite: inviteId })
  if (error) throw error
}

export async function declineInvite(inviteId: string): Promise<void> {
  const s = await createClient()
  const { error } = await s.from('room_invites').update({ status: 'declined' }).eq('id', inviteId)
  if (error) throw error
}

// Owner cancels a pending invite they sent (RLS "invites delete" gates this to the room owner).
export async function cancelInvite(inviteId: string): Promise<void> {
  const s = await createClient()
  const { error } = await s.from('room_invites').delete().eq('id', inviteId)
  if (error) throw error
}
