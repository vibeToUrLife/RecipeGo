import { notFound } from 'next/navigation'
import { AppNav } from '@/components/app-nav'
import { RoomSubNav } from '@/components/room-subnav'
import { RecipeLibrary } from '@/components/recipe-library'
import { getRoom } from '@/lib/data/rooms'
import { listRecipes } from '@/lib/data/recipes'
import { getT } from '@/lib/i18n-server'

export default async function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>
}) {
  const { roomId } = await params
  const [room, recipes, t] = await Promise.all([getRoom(roomId), listRecipes(roomId), getT()])
  if (!room) notFound()

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <section className="mb-6 rounded-2xl bg-gradient-to-br from-accent to-primary p-6 text-primary-foreground">
          <p className="text-xs uppercase tracking-widest opacity-90">{t('rooms.sharedKitchen')}</p>
          <h1 className="mt-1 font-serif text-3xl">{room.name}</h1>
        </section>

        <RoomSubNav roomId={roomId} />

        <RecipeLibrary recipes={recipes} addHref={`/recipes/new?room=${roomId}`} spinHref={`/rooms/${roomId}/spin`} />
      </main>
    </>
  )
}
