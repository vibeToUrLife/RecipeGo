import Link from 'next/link'
import { AppNav } from '@/components/app-nav'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InviteActions } from '@/components/invite-actions'
import { listMyRooms, listMyPendingInvites } from '@/lib/data/rooms'
import { createRoomAction } from './actions'

export default async function RoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>
}) {
  const sp = await searchParams
  const [rooms, invites] = await Promise.all([listMyRooms(), listMyPendingInvites()])

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="mb-6 font-serif text-2xl text-primary">Rooms</h1>

        {sp.error && (
          <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{sp.error}</p>
        )}
        {sp.message && (
          <p className="mb-4 rounded-md bg-secondary/15 px-3 py-2 text-sm text-secondary-foreground">{sp.message}</p>
        )}

        {/* Create a room */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="font-serif text-lg text-primary">Create a room</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createRoomAction} className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor="room-name" className="sr-only">Room name</Label>
                <Input id="room-name" name="name" placeholder="e.g. Family dinners" required />
              </div>
              <Button type="submit">Create</Button>
            </form>
          </CardContent>
        </Card>

        {/* Your rooms */}
        <section className="mb-8">
          <h2 className="mb-3 font-serif text-xl text-primary">Your rooms</h2>
          {rooms.length === 0 ? (
            <p className="text-sm text-muted-foreground">You have no rooms yet. Create one above to get started.</p>
          ) : (
            <div className="space-y-2">
              {rooms.map((r) => (
                <Card key={r.id}>
                  <CardContent className="flex items-center justify-between py-3">
                    <span className="font-medium">{r.name}</span>
                    <Button asChild size="sm" variant="secondary">
                      <Link href={`/rooms/${r.id}`}>Open</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Pending invites */}
        <section>
          <h2 className="mb-3 font-serif text-xl text-primary">Pending invites</h2>
          {invites.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending invites right now.</p>
          ) : (
            <div className="space-y-2">
              {invites.map((i) => (
                <Card key={i.id}>
                  <CardContent className="flex items-center justify-between py-3">
                    <span className="font-medium">{i.room_name}</span>
                    <InviteActions inviteId={i.id} />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  )
}
