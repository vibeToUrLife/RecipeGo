import { notFound } from 'next/navigation'
import { AppNav } from '@/components/app-nav'
import { getRoom } from '@/lib/data/rooms'
import { listRecipesWithIngredients } from '@/lib/data/recipes'
import { listPantry } from '@/lib/data/pantry'
import { ingredientUniverse } from '@/lib/cook/match'
import { CookPlanner } from '@/components/cook-planner'

export default async function RoomCookPage({ params }: { params: Promise<{ roomId: string }> }) {
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
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="mb-1 font-serif text-2xl text-primary">{room.name} — What can I cook?</h1>
        <p className="mb-5 text-sm text-muted-foreground">
          Tap the ingredients you have — we&apos;ll show which of this room&apos;s recipes you can make.
        </p>
        <CookPlanner recipes={recipes} universe={universe} initialHave={pantry} />
      </main>
    </>
  )
}
