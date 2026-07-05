'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useT } from '@/components/i18n-provider'
import { cn } from '@/lib/utils'

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
  const pathname = usePathname()
  const base = `/rooms/${roomId}`
  return (
    <nav className="mb-6 flex flex-wrap gap-3">
      {ROOM_NAV.map(({ suffix, labelKey }) => {
        const href = `${base}${suffix}`
        const active =
          suffix === '' ? pathname === base : pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Button
            key={suffix || 'home'}
            asChild
            variant="secondary"
            size="sm"
            className={cn(active && 'ring-2 ring-ring font-semibold')}
          >
            <Link href={href} aria-current={active ? 'page' : undefined}>
              {t(labelKey)}
            </Link>
          </Button>
        )
      })}
    </nav>
  )
}
