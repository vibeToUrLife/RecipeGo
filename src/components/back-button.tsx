'use client'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useT } from '@/components/i18n-provider'

export function BackButton() {
  const router = useRouter()
  const pathname = usePathname()
  const t = useT()
  // The home page is the app's root — "back" there would land on /login.
  if (pathname === '/') return null
  return (
    <Button variant="ghost" size="sm" onClick={() => router.back()} aria-label={t('common.back')}>
      ← {t('common.back')}
    </Button>
  )
}
