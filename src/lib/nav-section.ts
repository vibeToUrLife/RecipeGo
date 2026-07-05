// Maps the current path to the i18n key of the section the user is on, so the
// mobile menu can show a "Room name – Section" heading (e.g. "Southbay Kitchen
// – 计划"). Keys match the labels the menu's own links use.

export function roomSectionKey(pathname: string, roomId: string): string {
  const base = `/rooms/${roomId}`
  if (pathname === `${base}/members` || pathname.startsWith(`${base}/members/`)) return 'rooms.members'
  if (pathname === `${base}/cook` || pathname.startsWith(`${base}/cook/`)) return 'nav.ingredients'
  if (pathname === `${base}/shopping-list` || pathname.startsWith(`${base}/shopping-list/`)) return 'nav.shoppingList'
  if (pathname === `${base}/plan` || pathname.startsWith(`${base}/plan/`)) return 'nav.plan'
  // Room home, spin, and a recipe opened from the room → the recipe library.
  return 'nav.recipes'
}

export function personalSectionKey(pathname: string): string | null {
  if (pathname === '/cook' || pathname.startsWith('/cook/')) return 'nav.ingredients'
  if (pathname === '/shopping-list' || pathname.startsWith('/shopping-list/')) return 'nav.shoppingList'
  if (pathname === '/plan' || pathname.startsWith('/plan/')) return 'nav.plan'
  return null
}
