import { getShoppingList } from '@/lib/data/shopping'
import { AppNav } from '@/components/app-nav'
import { ShoppingListView } from '@/components/shopping-list-view'
import { getT } from '@/lib/i18n-server'

export default async function ShoppingListPage() {
  const t = await getT()
  const items = await getShoppingList()
  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="mb-4 font-serif text-2xl text-primary">{t('shop.title')}</h1>
        <ShoppingListView items={items} />
      </main>
    </>
  )
}
