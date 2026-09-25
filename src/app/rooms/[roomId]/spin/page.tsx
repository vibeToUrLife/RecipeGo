import { notFound } from 'next/navigation'
import { AppNav } from '@/components/app-nav'
import { RoomSubNav } from '@/components/room-subnav'
import { getRoom } from '@/lib/data/rooms'
import { listRecipes } from '@/lib/data/recipes'
import { SpinWheel } from '@/components/spin-wheel'
import { getT } from '@/lib/i18n-server'

export default async function RoomSpinPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const [room, recipes, t] = await Promise.all([getRoom(roomId), listRecipes(roomId), getT()])
  if (!room) notFound()
  return (
    <>
      <AppNav roomId={roomId} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <section className="mb-6 rounded-2xl bg-gradient-to-br from-accent to-primary p-6 text-primary-foreground shadow-sm">
          <p className="text-xs font-medium uppercase tracking-widest opacity-90">{room.name} · 🎲</p>
          <h1 className="mt-1 font-serif text-3xl">{t('spin.title')}</h1>
          <p className="mt-2 text-sm opacity-90">{t('spin.subtitle')}</p>
        </section>
        <RoomSubNav roomId={roomId} />
        <SpinWheel recipes={recipes} />
      </main>
    </>
  )
}
