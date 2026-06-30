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
        <h1 className="mb-1 font-serif text-2xl text-primary">Ingredients</h1>
        <p className="mb-5 text-sm text-muted-foreground">
          Add the ingredients you have at home — we&apos;ll show what you can cook right now and what you&apos;re almost ready for.
        </p>
        <CookPlanner recipes={recipes} universe={universe} initialHave={pantry} />
      </main>
    </>
  )
}
