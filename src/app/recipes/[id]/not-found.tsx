import Link from 'next/link'
import { AppNav } from '@/components/app-nav'
import { Button } from '@/components/ui/button'
import { getT } from '@/lib/i18n-server'

// A recipe deleted on another device (or in another room member's session) is
// the common way to land here, so this keeps the nav and offers a way back into
// the library rather than dead-ending on a generic 404.
export default async function RecipeNotFound() {
  const t = await getT()
  return (
    <>
      <AppNav />
      <main className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
        <span className="text-5xl" aria-hidden="true">🍽️</span>
        <h1 className="font-serif text-2xl text-primary">{t('notFound.recipeTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('notFound.recipeBody')}</p>
        <Button asChild><Link href="/">{t('notFound.backToLibrary')}</Link></Button>
      </main>
    </>
  )
}
