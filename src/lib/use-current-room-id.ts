'use client'
import { usePathname, useSearchParams } from 'next/navigation'

// The room the user is currently acting within: from /rooms/{id}/... in the
// path, or from ?room={id} on the add-recipe page — so the nav keeps the room
// context (header label + Recipes/Ingredients/Shopping links) instead of
// falling back to "My Recipes" while adding a recipe to a room.
export function useCurrentRoomId(): string | null {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const fromPath = pathname.match(/^\/rooms\/([^/]+)/)?.[1]
  if (fromPath) return fromPath
  if (pathname === '/recipes/new') return searchParams.get('room')
  return null
}
