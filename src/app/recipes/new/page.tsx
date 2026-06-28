import { AppNav } from '@/components/app-nav'
import { RecipeForm } from '@/components/recipe-form'

export default function NewRecipePage() {
  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="mb-4 font-serif text-2xl text-primary">Add a recipe</h1>
        <RecipeForm />
      </main>
    </>
  )
}
