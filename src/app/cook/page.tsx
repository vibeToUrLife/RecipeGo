import { AppNav } from '@/components/app-nav'
import { listRecipesWithIngredients } from '@/lib/data/recipes'
import { listPantry } from '@/lib/data/pantry'
import { ingredientUniverse } from '@/lib/cook/match'
import { CookPlanner } from '@/components/cook-planner'

export default async function CookPage() {
  const [recipes, pantry] = await Promise.all([listRecipesWithIngredients(), listPantry()])
  const universe = ingredientUniverse(recipes)
  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <section className="mb-6 rounded-2xl bg-gradient-to-br from-accent to-primary p-6 text-primary-foreground shadow-sm">
          <p className="text-xs font-medium uppercase tracking-widest opacity-90">What can I cook?</p>
          <h1 className="mt-1 font-serif text-3xl">Ingredients</h1>
          <p className="mt-2 max-w-prose text-sm opacity-90">
            Add the ingredients you have at home — we&apos;ll show what you can cook right now and what you&apos;re almost ready for.
          </p>
        </section>
        <CookPlanner recipes={recipes} universe={universe} initialHave={pantry} />
      </main>
    </>
  )
}
