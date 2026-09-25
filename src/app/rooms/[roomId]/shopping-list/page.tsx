import { notFound } from 'next/navigation'
import { AppNav } from '@/components/app-nav'
import { RoomSubNav } from '@/components/room-subnav'
import { ShoppingListView } from '@/components/shopping-list-view'
import { getRoom } from '@/lib/data/rooms'
import { getShoppingList } from '@/lib/data/shopping'
import { getT } from '@/lib/i18n-server'

export default async function RoomShoppingListPage({
  params,
}: {
  params: Promise<{ roomId: string }>
}) {
  const { roomId } = await params
  const [room, items, t] = await Promise.all([getRoom(roomId), getShoppingList(roomId), getT()])
  if (!room) notFound()

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="mb-4 font-serif text-2xl text-primary">{t('shop.roomTitle', { room: room.name })}</h1>
        <RoomSubNav roomId={roomId} />
        <ShoppingListView items={items} roomId={roomId} />
      </main>
    </>
  )
}
