import { notFound } from 'next/navigation'
import { AppNav } from '@/components/app-nav'
import { getRoom } from '@/lib/data/rooms'
import { listRecipesWithIngredients } from '@/lib/data/recipes'
import { listPantry } from '@/lib/data/pantry'
import { ingredientUniverse } from '@/lib/cook/match'
import { CookPlanner } from '@/components/cook-planner'
import { getT } from '@/lib/i18n-server'

export default async function RoomCookPage({ params }: { params: Promise<{ roomId: string }> }) {
  const t = await getT()
  const { roomId } = await params
  const [room, recipes, pantry] = await Promise.all([
    getRoom(roomId),
    listRecipesWithIngredients(roomId),
    listPantry(),
  ])
  if (!room) notFound()
  const universe = ingredientUniverse(recipes)
  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <section className="mb-6 rounded-2xl bg-gradient-to-br from-accent to-primary p-6 text-primary-foreground shadow-sm">
          <p className="text-xs font-medium uppercase tracking-widest opacity-90">{t('rooms.cookEyebrow', { room: room.name })}</p>
          <h1 className="mt-1 font-serif text-3xl">{t('cook.title')}</h1>
          <p className="mt-2 max-w-prose text-sm opacity-90">
            {t('cook.introRoom')}
          </p>
        </section>
        <CookPlanner recipes={recipes} universe={universe} initialHave={pantry} />
      </main>
    </>
  )
}
