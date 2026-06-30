import { listRecipes } from '@/lib/data/recipes'
import { AppNav } from '@/components/app-nav'
import { RecipeLibrary } from '@/components/recipe-library'
import { getT } from '@/lib/i18n-server'

export default async function HomePage() {
  const recipes = await listRecipes()
  const t = await getT()
  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <section className="mb-6 rounded-2xl bg-gradient-to-br from-accent to-primary p-6 text-primary-foreground">
          <p className="text-xs uppercase tracking-widest opacity-90">{t('home.fromYourKitchen')}</p>
          <h1 className="mt-1 font-serif text-3xl">{t('home.recipesSaved', { n: recipes.length })}</h1>
        </section>
        <RecipeLibrary recipes={recipes} />
      </main>
    </>
  )
}
