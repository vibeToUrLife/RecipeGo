'use client' // Error boundaries must be Client Components.
import { useEffect, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useT } from '@/components/i18n-provider'
import { BrandMark } from '@/components/icons'
import { canReloadToRecover, reloadToRecover } from '@/lib/recover'

const never = () => () => {}

// Catches render failures anywhere below the root layout. Most go away with a
// fresh copy of the page (lib/recover.ts), so it reloads by itself, the welcome
// animation's terracotta covering the screen till that comes. Only when that's
// been tried twice in the last minute does it show the error, with its Retry.
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  const t = useT()
  const reloading = useSyncExternalStore(never, canReloadToRecover, () => true)

  useEffect(() => {
    console.error(error)
    if (reloading) reloadToRecover()
  }, [error, reloading])

  if (reloading) return <div className="splash-cover" aria-hidden />

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <BrandMark className="size-14" />
      <h1 className="font-serif text-2xl text-primary">{t('error.title')}</h1>
      <p className="text-sm text-muted-foreground">{t('error.body')}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={() => unstable_retry()}>{t('error.retry')}</Button>
        <Button asChild variant="outline"><Link href="/">{t('error.home')}</Link></Button>
      </div>
      {error.digest && (
        <p className="font-mono text-xs text-muted-foreground">{t('error.ref', { id: error.digest })}</p>
      )}
    </main>
  )
}
