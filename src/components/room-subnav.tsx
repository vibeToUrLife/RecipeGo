import { NavLinks } from '@/components/nav-links'

// A room's pill row under the page heading. It renders the header's own links,
// so the order always matches the header, and it only shows below lg — where
// AppNav folds those pills into the hamburger menu.
//
// Scrolled down, it stays pinned under the header, which is 61px tall there
// (py-3 around its 36px menu button, plus its border). z-15 keeps it over the
// page (the spin wheel's pointer is z-10) and under the header's menu, and
// -mt-2 cancels the padding it needs once pinned, so at rest nothing moves.
export function RoomSubNav({ roomId }: { roomId: string }) {
  return (
    <nav className="sticky top-[61px] z-15 -mx-4 -mt-2 mb-4 flex flex-wrap gap-3 bg-background/80 px-4 py-2 backdrop-blur print:hidden lg:hidden">
      <NavLinks roomId={roomId} />
    </nav>
  )
}
