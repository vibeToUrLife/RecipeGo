'use client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useCurrentRoomId } from '@/lib/use-current-room-id'
import { useT } from '@/components/i18n-provider'

// Recipes / Cook / Shopping List point at the current context: your personal
// recipes by default, or the current room when you're inside one — so a room's
// Cook and Shopping List stay independent from your personal ones.
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
      <Button asChild variant="ghost" size="sm"><Link href={recipesHref}>{t('nav.recipes')}</Link></Button>
      <Button asChild variant="ghost" size="sm"><Link href={planHref}>{t('nav.plan')}</Link></Button>
      <Button asChild variant="ghost" size="sm"><Link href={cookHref}>{t('nav.ingredients')}</Link></Button>
      <Button asChild variant="ghost" size="sm"><Link href={shoppingHref}>{t('nav.shoppingList')}</Link></Button>
    </>
  )
}
