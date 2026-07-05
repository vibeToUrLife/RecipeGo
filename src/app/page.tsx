import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { listRecipes } from '@/lib/data/recipes'
import { listMyRooms } from '@/lib/data/rooms'
import { roomToRestore } from '@/lib/last-collection'
import { AppNav } from '@/components/app-nav'
import { RecipeLibrary } from '@/components/recipe-library'
import { RememberCollection } from '@/components/remember-collection'
import { getT } from '@/lib/i18n-server'

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ home?: string }>
}) {
  const { home } = await searchParams
  // Return the user to their last room on a fresh visit — unless they explicitly
  // asked for personal ("My Recipes" links carry ?home=1). Validate membership so
  // a left/deleted room falls back to personal instead of bouncing to a 404.
  if (!home) {
    const last = (await cookies()).get('last_collection')?.value
    if (last && last !== 'personal') {
      const myRoomIds = (await listMyRooms()).map((r) => r.id)
      const target = roomToRestore(home, last, myRoomIds)
      if (target) redirect(`/rooms/${target}`)
    }
  }

  const recipes = await listRecipes()
  const t = await getT()
  return (
    <>
      {/* Landing here means personal is the active collection now. */}
      <RememberCollection value="personal" />
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
