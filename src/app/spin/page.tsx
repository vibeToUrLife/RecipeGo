import { listRecipes } from '@/lib/data/recipes'
import { AppNav } from '@/components/app-nav'
import { SpinWheel } from '@/components/spin-wheel'
import { getT } from '@/lib/i18n-server'

export default async function SpinPage() {
  const [recipes, t] = await Promise.all([listRecipes(), getT()])
  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <section className="mb-6 rounded-2xl bg-gradient-to-br from-accent to-primary p-6 text-primary-foreground shadow-sm">
          <p className="text-xs font-medium uppercase tracking-widest opacity-90">🎲</p>
          <h1 className="mt-1 font-serif text-3xl">{t('spin.title')}</h1>
          <p className="mt-2 text-sm opacity-90">{t('spin.subtitle')}</p>
        </section>
        <SpinWheel recipes={recipes} />
      </main>
    </>
  )
}
