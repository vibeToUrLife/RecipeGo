import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { getT } from '@/lib/i18n-server'

export default async function NotFound() {
  const t = await getT()
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="text-5xl" aria-hidden="true">🍽️</span>
      <h1 className="font-serif text-2xl text-primary">{t('notFound.title')}</h1>
      <p className="text-sm text-muted-foreground">{t('notFound.body')}</p>
      <Button asChild><Link href="/">{t('error.home')}</Link></Button>
    </main>
  )
}
