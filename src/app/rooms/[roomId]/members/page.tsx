import { notFound } from 'next/navigation'
import { AppNav } from '@/components/app-nav'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MemberRow } from '@/components/member-row'
import { getRoom, listMembers, listRoomInvites } from '@/lib/data/rooms'
import { createClient } from '@/utils/supabase/server'
import {
  inviteAction,
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

  const [room, members, invites] = await Promise.all([
    getRoom(roomId),
    listMembers(roomId),
    listRoomInvites(roomId),
  ])

  if (!room) notFound()

  const {
    data: { user },
  } = await (await createClient()).auth.getUser()

  const isOwner = room.owner_id === user?.id

  const invite = inviteAction.bind(null, roomId)
  const rename = renameRoomAction.bind(null, roomId)
  const deleteRoom = deleteRoomAction.bind(null, roomId)
  const leaveRoom = leaveRoomAction.bind(null, roomId)

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="mb-6 font-serif text-2xl text-primary">{room.name} — Members</h1>

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
            <CardTitle className="font-serif text-lg text-primary">Members</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {members.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">No members yet.</p>
            ) : (
              members.map((m) => {
                const name = m.display_name ?? 'Member'
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
              <CardTitle className="font-serif text-lg text-primary">Pending invites</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {invites.map((i) => (
                <p key={i.id} className="text-sm text-muted-foreground">
                  {i.email}
                </p>
              ))}
            </CardContent>
          </Card>
        )}

        {isOwner ? (
          <>
            {/* Invite by email */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="font-serif text-lg text-primary">Invite by email</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={invite} className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="invite-email" className="sr-only">
                      Email address
                    </Label>
                    <Input
                      id="invite-email"
                      name="email"
                      type="email"
                      placeholder="friend@example.com"
                      required
                    />
                  </div>
                  <Button type="submit">Invite</Button>
                </form>
              </CardContent>
            </Card>

            {/* Rename room */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="font-serif text-lg text-primary">Rename room</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={rename} className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="room-name" className="sr-only">
                      Room name
                    </Label>
                    <Input
                      id="room-name"
                      name="name"
                      defaultValue={room.name}
                      required
                    />
                  </div>
                  <Button type="submit">Save</Button>
                </form>
              </CardContent>
            </Card>

            {/* Delete room */}
            <form action={deleteRoom}>
              <Button type="submit" variant="destructive" size="sm">
                Delete room
              </Button>
            </form>
          </>
        ) : (
          /* Leave room */
          <form action={leaveRoom}>
            <Button type="submit" variant="outline" size="sm">
              Leave room
            </Button>
          </form>
        )}
      </main>
    </>
  )
}
