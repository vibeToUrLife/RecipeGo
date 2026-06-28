import { AppNav } from '@/components/app-nav'
import { NewRecipeClient } from '@/components/new-recipe-client'
import { listMyRooms } from '@/lib/data/rooms'

export default async function NewRecipePage({ searchParams }: { searchParams: Promise<{ room?: string }> }) {
  const { room } = await searchParams
  const rooms = await listMyRooms()
  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="mb-4 font-serif text-2xl text-primary">Add a recipe</h1>
        <NewRecipeClient rooms={rooms} defaultRoomId={room ?? null} />
      </main>
    </>
  )
}
