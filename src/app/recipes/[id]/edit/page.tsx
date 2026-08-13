import { notFound } from 'next/navigation'
import { getRecipe } from '@/lib/data/recipes'
import { listMyRooms } from '@/lib/data/rooms'
import { AppNav } from '@/components/app-nav'
import { RecipeForm } from '@/components/recipe-form'
import { removeRecipe } from '@/app/recipes/actions'
import { Button } from '@/components/ui/button'
import { getT } from '@/lib/i18n-server'

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [recipe, rooms, t] = await Promise.all([getRecipe(id), listMyRooms(), getT()])
  if (!recipe) notFound()
  const remove = removeRecipe.bind(null, id)
  return (
    <>
      <AppNav roomId={recipe.room_id} />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="mb-4 font-serif text-2xl text-primary">{t('form.editRecipe')}</h1>
        <RecipeForm recipe={recipe} rooms={rooms} />
        <form action={remove} className="mt-6">
          <Button type="submit" variant="destructive" size="sm">{t('form.deleteRecipe')}</Button>
        </form>
      </main>
    </>
  )
}
