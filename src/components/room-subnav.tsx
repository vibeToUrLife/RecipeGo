'use client'
import { useEffect, useRef } from 'react'
import { NavLinks } from '@/components/nav-links'

// A room's pill row under the page heading. It renders the header's own links,
// so the order always matches the header, and it only shows below lg — where
// AppNav folds those pills into the hamburger menu.
//
// Scrolled down, it stays pinned under the header, which is 61px tall there
// (py-3 around its 36px menu button, plus its border). z-15 keeps it over the
// page (the spin wheel's pointer is z-10) and under the header's menu, and
// -mt-2 cancels the padding it needs once pinned, so at rest nothing moves.
//
// The pills keep to one line, so the pinned row stays one pill tall. Where they
// don't all fit (in English, on a narrow phone) the row scrolls sideways, with
// no scrollbar, and opens with the current page's pill in the middle.
export function RoomSubNav({ roomId }: { roomId: string }) {
  const row = useRef<HTMLElement>(null)
  useEffect(() => {
    const nav = row.current
    const current = nav?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!nav || !current) return
    nav.scrollLeft = current.offsetLeft - (nav.clientWidth - current.offsetWidth) / 2
  }, [])
  return (
    <nav
      ref={row}
      className="sticky top-[61px] z-15 -mx-4 -mt-2 mb-4 flex gap-3 overflow-x-auto bg-background/80 px-4 py-2 backdrop-blur [scrollbar-width:none] print:hidden lg:hidden [&::-webkit-scrollbar]:hidden"
    >
      <NavLinks roomId={roomId} />
    </nav>
  )
}
