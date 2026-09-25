'use client'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useCurrentRoomId } from '@/lib/use-current-room-id'
import { useT } from '@/components/i18n-provider'
import { cn } from '@/lib/utils'

// Recipes / Plan / Ingredients / Shopping List point at the current context: your
// personal recipes by default, or the current room when you're inside one — so a
// room's Cook and Shopping List stay independent from your personal ones. Inside
// a room there's also Members, last so the shared links keep their places.
export function NavLinks({ roomId: roomIdProp }: { roomId?: string | null } = {}) {
  const hookRoomId = useCurrentRoomId()
  const t = useT()
  // An explicit prop (even null = personal) wins over the URL-derived value.
  const roomId = roomIdProp !== undefined ? roomIdProp : hookRoomId
  const recipesHref = roomId ? `/rooms/${roomId}` : '/'
  const cookHref = roomId ? `/rooms/${roomId}/cook` : '/cook'
  const shoppingHref = roomId ? `/rooms/${roomId}/shopping-list` : '/shopping-list'
  const planHref = roomId ? `/rooms/${roomId}/plan` : '/plan'
  return (
    <>
      <NavPill href={recipesHref} exact>{t('nav.recipes')}</NavPill>
      <NavPill href={planHref}>{t('nav.plan')}</NavPill>
      <NavPill href={cookHref}>{t('nav.ingredients')}</NavPill>
      <NavPill href={shoppingHref}>{t('nav.shoppingList')}</NavPill>
      {roomId && <NavPill href={`/rooms/${roomId}/members`}>{t('rooms.members')}</NavPill>}
    </>
  )
}

// A green pill link; the current page gets a ring. `exact` is for a home link
// (`/`, `/rooms/{id}`), which would otherwise match every page under it.
function NavPill({ href, exact = false, children }: { href: string; exact?: boolean; children: ReactNode }) {
  const pathname = usePathname()
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
  return (
    <Button
      asChild
      variant="secondary"
      size="sm"
      className={cn(active && 'ring-2 ring-ring font-semibold')}
    >
      <Link href={href} aria-current={active ? 'page' : undefined}>
        {children}
      </Link>
    </Button>
  )
}
