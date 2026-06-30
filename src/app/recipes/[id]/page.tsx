import { notFound } from 'next/navigation'
import { getRecipe } from '@/lib/data/recipes'
import { AppNav } from '@/components/app-nav'
import { RecipeDetail } from '@/components/recipe-detail'

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const recipe = await getRecipe(id)
  if (!recipe) notFound()
  return (
    <>
      <AppNav roomId={recipe.room_id} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <RecipeDetail recipe={recipe} />
      </main>
    </>
  )
}
