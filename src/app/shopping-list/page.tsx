import { getShoppingList } from '@/lib/data/shopping'
import { AppNav } from '@/components/app-nav'
import { ShoppingListView } from '@/components/shopping-list-view'

export default async function ShoppingListPage() {
  const items = await getShoppingList()
  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="mb-4 font-serif text-2xl text-primary">🛒 Shopping List</h1>
        <ShoppingListView items={items} />
      </main>
    </>
  )
}
