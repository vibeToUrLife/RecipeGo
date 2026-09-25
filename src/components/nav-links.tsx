'use client'
import { NavPill } from '@/components/nav-pill'
import { useCurrentRoomId } from '@/lib/use-current-room-id'
import { useT } from '@/components/i18n-provider'

// Recipes / Cook / Shopping List point at the current context: your personal
// recipes by default, or the current room when you're inside one — so a room's
// Cook and Shopping List stay independent from your personal ones. They're the
// same green pills as a room's sub-nav, with the current page ringed.
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
    </>
  )
}
