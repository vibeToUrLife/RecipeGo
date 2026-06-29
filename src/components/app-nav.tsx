import Link from 'next/link'
import { signOut } from '@/app/login/oauth'
import { Button } from '@/components/ui/button'
import { listMyRooms } from '@/lib/data/rooms'
import { RoomSwitcher } from '@/components/room-switcher'
import { BackButton } from '@/components/back-button'

export async function AppNav() {
  const myRooms = await listMyRooms()
  return (
    <header className="sticky top-0 z-20 border-b bg-card/80 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <BackButton />
          <Link href="/" className="font-serif text-xl font-semibold text-primary">🍳 RecipeGo</Link>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <RoomSwitcher rooms={myRooms} />
          <Button asChild variant="ghost" size="sm"><Link href="/">Recipes</Link></Button>
          <Button asChild variant="ghost" size="sm"><Link href="/shopping-list">Shopping List</Link></Button>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">Sign out</Button>
          </form>
        </div>
      </nav>
    </header>
  )
}
