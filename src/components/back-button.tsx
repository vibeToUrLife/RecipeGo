'use client'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useT } from '@/components/i18n-provider'
import { useCurrentRoomId } from '@/lib/use-current-room-id'

// Pages that know their recipe's room (detail/edit) pass roomId so "back" lands
// on the right recipe list.
export function BackButton({ roomId: roomIdProp }: { roomId?: string | null } = {}) {
  const router = useRouter()
  const pathname = usePathname()
  const t = useT()
  const hookRoomId = useCurrentRoomId()
  const roomId = roomIdProp !== undefined ? roomIdProp : hookRoomId

  // Top-level lists have no back button: the personal home and a room's recipe
  // page (you got there from the switcher, so there's nowhere to go "back" to).
  if (pathname === '/' || /^\/rooms\/[^/]+$/.test(pathname)) return null

  const back = (href: string) => (
    <Button asChild variant="ghost" size="sm">
      <Link href={href}>← {t('common.back')}</Link>
    </Button>
  )

  // Editing a recipe → back to that recipe.
  const editMatch = pathname.match(/^\/recipes\/([^/]+)\/edit$/)
  if (editMatch) return back(`/recipes/${editMatch[1]}`)

  // Any other recipe page (detail, new) → back to the recipe list it belongs to.
  if (pathname.startsWith('/recipes/')) return back(roomId ? `/rooms/${roomId}` : '/')

  // Everything else → normal browser back.
  return (
    <Button variant="ghost" size="sm" onClick={() => router.back()} aria-label={t('common.back')}>
      ← {t('common.back')}
    </Button>
  )
}
