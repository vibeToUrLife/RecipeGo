'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'

// Recipes / Cook / Shopping List point at the current context: your personal
// recipes by default, or the current room when you're inside one — so a room's
// Cook and Shopping List stay independent from your personal ones.
export function NavLinks() {
  const pathname = usePathname()
  const roomId = pathname.match(/^\/rooms\/([^/]+)/)?.[1] ?? null
  const recipesHref = roomId ? `/rooms/${roomId}` : '/'
  const cookHref = roomId ? `/rooms/${roomId}/cook` : '/cook'
  const shoppingHref = roomId ? `/rooms/${roomId}/shopping-list` : '/shopping-list'
  return (
    <>
      <Button asChild variant="ghost" size="sm"><Link href={recipesHref}>Recipes</Link></Button>
      <Button asChild variant="ghost" size="sm"><Link href={cookHref}>Ingredients</Link></Button>
      <Button asChild variant="ghost" size="sm"><Link href={shoppingHref}>Shopping List</Link></Button>
    </>
  )
}
