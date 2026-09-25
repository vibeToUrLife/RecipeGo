import { notFound } from 'next/navigation'
import { AppNav } from '@/components/app-nav'
import { RoomSubNav } from '@/components/room-subnav'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MemberRow } from '@/components/member-row'
import { InviteForm } from '@/components/invite-form'
import { InviteCancelButton } from '@/components/invite-cancel-button'
import { getRoom, listMembers, listRoomInvites } from '@/lib/data/rooms'
import { createClient } from '@/utils/supabase/server'
import { getT } from '@/lib/i18n-server'
import {
  renameRoomAction,
  deleteRoomAction,
  leaveRoomAction,
} from '@/app/rooms/actions'

export default async function MembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomId: string }>
  searchParams: Promise<{ error?: string; message?: string }>
}) {
  const { roomId } = await params
  const sp = await searchParams

  const [room, members, invites, t] = await Promise.all([
    getRoom(roomId),
    listMembers(roomId),
    listRoomInvites(roomId),
    getT(),
  ])

  if (!room) notFound()

  const {
    data: { user },
  } = await (await createClient()).auth.getUser()

  const isOwner = room.owner_id === user?.id

  const rename = renameRoomAction.bind(null, roomId)
  const deleteRoom = deleteRoomAction.bind(null, roomId)
  const leaveRoom = leaveRoomAction.bind(null, roomId)

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="mb-6 font-serif text-2xl text-primary">{t('rooms.membersTitle', { room: room.name })}</h1>

        <RoomSubNav roomId={roomId} />

        {sp.error && (
          <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {sp.error}
          </p>
        )}
        {sp.message && (
          <p className="mb-4 rounded-md bg-secondary/15 px-3 py-2 text-sm text-secondary-foreground">
            {sp.message}
          </p>
        )}

        {/* Members list */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="font-serif text-lg text-primary">{t('rooms.members')}</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {members.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">{t('rooms.noMembers')}</p>
            ) : (
              members.map((m) => {
                const name = m.display_name ?? t('rooms.defaultMemberName')
                const canRemove = isOwner && m.user_id !== user?.id && m.role !== 'owner'
                return (
                  <MemberRow
                    key={m.user_id}
                    roomId={roomId}
                    userId={m.user_id}
                    name={name}
                    role={m.role}
                    canRemove={canRemove}
                  />
                )
              })
            )}
          </CardContent>
        </Card>

        {/* Pending invites */}
        {isOwner && invites.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="font-serif text-lg text-primary">{t('rooms.pendingInvites')}</CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              {invites.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-2 py-1.5">
                  <p className="text-sm text-muted-foreground">{i.email}</p>
                  <InviteCancelButton roomId={roomId} inviteId={i.id} />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {isOwner ? (
          <>
            {/* Invite by email */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="font-serif text-lg text-primary">{t('rooms.inviteByEmail')}</CardTitle>
              </CardHeader>
              <CardContent>
                <InviteForm roomId={roomId} />
              </CardContent>
            </Card>

            {/* Rename room */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="font-serif text-lg text-primary">{t('rooms.renameRoom')}</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={rename} className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="room-name" className="sr-only">
                      {t('rooms.roomName')}
                    </Label>
                    <Input
                      id="room-name"
                      name="name"
                      defaultValue={room.name}
                      required
                    />
                  </div>
                  <Button type="submit">{t('common.save')}</Button>
                </form>
              </CardContent>
            </Card>

            {/* Delete room */}
            <form action={deleteRoom}>
              <Button type="submit" variant="destructive" size="sm">
                {t('rooms.deleteRoom')}
              </Button>
            </form>
          </>
        ) : (
          /* Leave room */
          <form action={leaveRoom}>
            <Button type="submit" variant="outline" size="sm">
              {t('rooms.leaveRoom')}
            </Button>
          </form>
        )}
      </main>
    </>
  )
}
