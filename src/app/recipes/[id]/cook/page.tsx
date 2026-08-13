import { notFound } from 'next/navigation'
import { getRecipe } from '@/lib/data/recipes'
import { CookMode } from '@/components/cook-mode'

// Full-screen cooking view. No AppNav — the point is that nothing competes with
// the current step. `?servings=` carries whatever the detail page's scaler was
// set to, so the quantities you cook from are the ones you were just reading.
export default async function CookModePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ servings?: string }>
}) {
  const [{ id }, { servings }] = await Promise.all([params, searchParams])
  const recipe = await getRecipe(id)
  if (!recipe) notFound()

  const asked = Number(servings)
  const target = Number.isFinite(asked) && asked >= 1 && asked <= 100 ? Math.round(asked) : recipe.servings

  return <CookMode recipe={recipe} servings={target} />
}
