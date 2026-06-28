import { notFound } from 'next/navigation'
import { getRecipe } from '@/lib/data/recipes'
import { AppNav } from '@/components/app-nav'
import { RecipeForm } from '@/components/recipe-form'
import { removeRecipe } from '@/app/recipes/actions'
import { Button } from '@/components/ui/button'

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const recipe = await getRecipe(id)
  if (!recipe) notFound()
  const remove = removeRecipe.bind(null, id)
  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="mb-4 font-serif text-2xl text-primary">Edit recipe</h1>
        <RecipeForm recipe={recipe} />
        <form action={remove} className="mt-6">
          <Button type="submit" variant="destructive" size="sm">Delete recipe</Button>
        </form>
      </main>
    </>
  )
}
