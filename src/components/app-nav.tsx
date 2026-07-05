import Link from 'next/link'
import { signOut } from '@/app/login/oauth'
import { Button } from '@/components/ui/button'
import { listMyRooms } from '@/lib/data/rooms'
import { RoomSwitcher } from '@/components/room-switcher'
import { BackButton } from '@/components/back-button'
import { NavLinks } from '@/components/nav-links'
import { MobileRoomLabel } from '@/components/mobile-room-label'
import { LanguageSwitcher } from '@/components/language-switcher'
import { ThemeToggle } from '@/components/theme-toggle'
import { MobileMenu } from '@/components/mobile-menu'
import { getT } from '@/lib/i18n-server'

// Pages that know their room (e.g. a recipe's detail/edit page) can pass
// roomId so the nav keeps the room context even when it isn't in the URL.
export async function AppNav({ roomId }: { roomId?: string | null } = {}) {
  const [myRooms, t] = await Promise.all([listMyRooms(), getT()])
  return (
    <header className="sticky top-0 z-20 border-b bg-card/80 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <BackButton roomId={roomId} />
          <Link href="/" aria-label="RecipeGo" className="flex shrink-0 items-center gap-1 font-serif text-xl font-semibold text-primary">
            <span aria-hidden>🍳</span>
            <span className="hidden md:inline">RecipeGo</span>
          </Link>
          {/* Mobile only: current room + page (desktop shows the RoomSwitcher). */}
          <MobileRoomLabel rooms={myRooms} roomId={roomId} />
        </div>
        <div className="flex items-center gap-2 text-sm">
          {/* Desktop: full inline nav */}
          <div className="hidden items-center gap-2 md:flex">
            <RoomSwitcher rooms={myRooms} roomId={roomId} />
            <NavLinks roomId={roomId} />
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm">{t('nav.signOut')}</Button>
            </form>
          </div>
          {/* Always visible (compact) */}
          <ThemeToggle />
          <LanguageSwitcher />
          {/* Mobile: everything in a hamburger */}
          <MobileMenu rooms={myRooms} signOut={signOut} />
        </div>
      </nav>
    </header>
  )
}
