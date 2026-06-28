import { notFound } from 'next/navigation'
import { AppNav } from '@/components/app-nav'
import { ShoppingListView } from '@/components/shopping-list-view'
import { getRoom } from '@/lib/data/rooms'
import { getShoppingList } from '@/lib/data/shopping'

export default async function RoomShoppingListPage({
  params,
}: {
  params: Promise<{ roomId: string }>
}) {
  const { roomId } = await params
  const [room, items] = await Promise.all([getRoom(roomId), getShoppingList(roomId)])
  if (!room) notFound()

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="mb-4 font-serif text-2xl text-primary">🛒 {room.name} — Shopping list</h1>
        <ShoppingListView items={items} roomId={roomId} />
      </main>
    </>
  )
}
