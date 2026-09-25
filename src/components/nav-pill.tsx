'use client'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// The green pill link shared by the header nav and a room's sub-nav, so the two
// always look alike; the current page gets a ring. `exact` is for a home link
// (`/`, `/rooms/{id}`), which would otherwise match every page under it.
export function NavPill({ href, exact = false, children }: { href: string; exact?: boolean; children: ReactNode }) {
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
