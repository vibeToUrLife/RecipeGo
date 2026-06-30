import Link from 'next/link'
import { signOut } from '@/app/login/oauth'
import { Button } from '@/components/ui/button'
import { listMyRooms } from '@/lib/data/rooms'
import { RoomSwitcher } from '@/components/room-switcher'
import { BackButton } from '@/components/back-button'
import { NavLinks } from '@/components/nav-links'

// Pages that know their room (e.g. a recipe's detail/edit page) can pass
// roomId so the nav keeps the room context even when it isn't in the URL.
export async function AppNav({ roomId }: { roomId?: string | null } = {}) {
  const myRooms = await listMyRooms()
  return (
    <header className="sticky top-0 z-20 border-b bg-card/80 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <BackButton />
          <Link href="/" className="font-serif text-xl font-semibold text-primary">🍳 RecipeGo</Link>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <RoomSwitcher rooms={myRooms} roomId={roomId} />
          <NavLinks roomId={roomId} />
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">Sign out</Button>
          </form>
        </div>
      </nav>
    </header>
  )
}
