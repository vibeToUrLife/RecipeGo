'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import * as rooms from '@/lib/data/rooms'
import { isValidEmail } from '@/lib/email'

export async function createRoomAction(formData: FormData) {
  const name = (formData.get('name') as string)?.trim()
  if (!name) redirect('/rooms?error=' + encodeURIComponent('Room name is required'))
  const id = await rooms.createRoom(name)
  revalidatePath('/rooms')
  redirect(`/rooms/${id}`)
}

export async function inviteAction(roomId: string, formData: FormData) {
  const email = (formData.get('email') as string) ?? ''
  if (!isValidEmail(email)) redirect(`/rooms/${roomId}/members?error=` + encodeURIComponent('Enter a valid email'))
  await rooms.inviteToRoom(roomId, email)
  revalidatePath(`/rooms/${roomId}/members`)
  redirect(`/rooms/${roomId}/members?message=` + encodeURIComponent('Invite sent'))
}

export async function acceptInviteAction(id: string) {
  await rooms.acceptInvite(id)
  revalidatePath('/rooms')
}

export async function declineInviteAction(id: string) {
  await rooms.declineInvite(id)
  revalidatePath('/rooms')
}

export async function removeMemberAction(roomId: string, userId: string) {
  await rooms.removeMember(roomId, userId)
  revalidatePath(`/rooms/${roomId}/members`)
}

export async function leaveRoomAction(roomId: string) {
  await rooms.leaveRoom(roomId)
  revalidatePath('/rooms')
  redirect('/rooms')
}

export async function renameRoomAction(roomId: string, formData: FormData) {
  const name = (formData.get('name') as string)?.trim()
  if (name) await rooms.renameRoom(roomId, name)
  revalidatePath(`/rooms/${roomId}/members`)
}

export async function deleteRoomAction(roomId: string) {
  await rooms.deleteRoom(roomId)
  revalidatePath('/rooms')
  redirect('/rooms')
}
