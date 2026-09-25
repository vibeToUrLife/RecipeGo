import { NavLinks } from '@/components/nav-links'

// A room's pill row under the page heading. It renders the header's own links,
// so the order always matches the header, and it only shows below lg — where
// AppNav folds those pills into the hamburger menu.
export function RoomSubNav({ roomId }: { roomId: string }) {
  return (
    <nav className="mb-6 flex flex-wrap gap-3 print:hidden lg:hidden">
      <NavLinks roomId={roomId} />
    </nav>
  )
}
