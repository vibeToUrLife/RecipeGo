'use client'
import { usePathname } from 'next/navigation'
import type { Room } from '@/lib/db-types'
import { useCurrentRoomId } from '@/lib/use-current-room-id'
import { useT } from '@/components/i18n-provider'

// Shown in the mobile header (desktop uses the RoomSwitcher instead) so members
// can see which room AND page they're on without opening the hamburger — reads
// e.g. "Southbay Kitchen – Recipes", updating as you navigate.
export function MobileRoomLabel({ rooms, roomId }: { rooms: Room[]; roomId?: string | null }) {
  const hookRoomId = useCurrentRoomId()
  const pathname = usePathname()
  const t = useT()
  // An explicit prop (even null = personal) wins over the URL-derived value.
  const currentRoomId = roomId !== undefined ? roomId : hookRoomId
  const room = currentRoomId ? rooms.find((r) => r.id === currentRoomId) : null

  let label: string
  if (room) {
    // In a room, always append the section — including Recipes, so the library
    // page reads "Room – Recipes" (the "room name - recipe" the header should show).
    label = `${room.name} – ${t(roomSectionKey(pathname, room.id))}`
  } else {
    // Personal: the label already says "My Recipes", so only append a section
    // when it isn't the recipes home (avoids a redundant "My Recipes – Recipes").
    const key = personalSectionKey(pathname)
    label = key ? `${t('nav.myRecipes')} – ${t(key)}` : t('nav.myRecipes')
  }

  return (
    <span className="min-w-0 truncate text-sm font-medium text-foreground md:hidden" aria-live="polite">
      {label}
    </span>
  )
}

function roomSectionKey(pathname: string, roomId: string): string {
  const base = `/rooms/${roomId}`
  if (pathname === `${base}/members` || pathname.startsWith(`${base}/members/`)) return 'rooms.members'
  if (pathname === `${base}/cook` || pathname.startsWith(`${base}/cook/`)) return 'nav.ingredients'
  if (pathname === `${base}/shopping-list` || pathname.startsWith(`${base}/shopping-list/`)) return 'rooms.shoppingList'
  if (pathname === `${base}/plan` || pathname.startsWith(`${base}/plan/`)) return 'nav.plan'
  // Room home, spin, and any recipe detail reached from the room → the library.
  return 'nav.recipes'
}

function personalSectionKey(pathname: string): string | null {
  if (pathname === '/cook' || pathname.startsWith('/cook/')) return 'nav.ingredients'
  if (pathname === '/shopping-list' || pathname.startsWith('/shopping-list/')) return 'rooms.shoppingList'
  if (pathname === '/plan' || pathname.startsWith('/plan/')) return 'nav.plan'
  return null
}
