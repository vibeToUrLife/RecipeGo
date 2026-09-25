'use client'
import { NavPill } from '@/components/nav-pill'
import { useT } from '@/components/i18n-provider'

// Defined once — the room's navigable places. Reuses existing i18n keys.
const ROOM_NAV = [
  { suffix: '', labelKey: 'nav.recipes' },
  { suffix: '/members', labelKey: 'rooms.members' },
  { suffix: '/cook', labelKey: 'nav.ingredients' },
  { suffix: '/shopping-list', labelKey: 'rooms.shoppingList' },
  { suffix: '/plan', labelKey: 'nav.plan' },
] as const

export function RoomSubNav({ roomId }: { roomId: string }) {
  const t = useT()
  const base = `/rooms/${roomId}`
  return (
    <nav className="mb-6 flex flex-wrap gap-3 print:hidden">
      {ROOM_NAV.map(({ suffix, labelKey }) => (
        <NavPill key={suffix || 'home'} href={`${base}${suffix}`} exact={suffix === ''}>
          {t(labelKey)}
        </NavPill>
      ))}
    </nav>
  )
}
