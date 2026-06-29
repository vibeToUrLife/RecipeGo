'use client'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function BackButton() {
  const router = useRouter()
  const pathname = usePathname()
  // The home page is the app's root — "back" there would land on /login.
  if (pathname === '/') return null
  return (
    <Button variant="ghost" size="sm" onClick={() => router.back()} aria-label="Go back">
      ← Back
    </Button>
  )
}
