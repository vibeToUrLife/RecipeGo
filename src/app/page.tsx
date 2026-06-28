import { listRecipes } from '@/lib/data/recipes'
import { AppNav } from '@/components/app-nav'
import { RecipeLibrary } from '@/components/recipe-library'

export default async function HomePage() {
  const recipes = await listRecipes()
  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <section className="mb-6 rounded-2xl bg-gradient-to-br from-accent to-primary p-6 text-primary-foreground">
          <p className="text-xs uppercase tracking-widest opacity-90">From your kitchen</p>
          <h1 className="mt-1 font-serif text-3xl">{recipes.length} recipes saved</h1>
        </section>
        <RecipeLibrary recipes={recipes} />
      </main>
    </>
  )
}
