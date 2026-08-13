'use client' // Error boundaries must be Client Components.
import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useT } from '@/components/i18n-provider'

// Catches render failures anywhere below the root layout. Without this, a
// dropped database connection showed Next's default error screen and the only
// way out was the browser's back button.
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  const t = useT()

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="text-5xl" aria-hidden="true">🍳</span>
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
