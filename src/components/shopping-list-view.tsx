'use client'
import { useOptimistic, useTransition } from 'react'
import { toast } from 'sonner'
import type { ShoppingListRow } from '@/lib/data/shopping'
import { AISLE_ORDER } from '@/lib/aisles'
import { toggleItemAction, removeItemAction, completeShoppingAction } from '@/app/shopping-list/actions'
import { AddShoppingItem } from '@/components/add-shopping-item'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'

function fmtQty(q: number | null) {
  if (q === null) return ''
  return Number.isInteger(q) ? String(q) : q.toFixed(2).replace(/\.?0+$/, '')
}

export function ShoppingListView({ items, roomId }: { items: ShoppingListRow[]; roomId?: string | null }) {
  const [optimistic, setOptimistic] = useOptimistic(items)
  const [, start] = useTransition()
  const rid = roomId ?? null

  function toggle(row: ShoppingListRow) {
    start(async () => {
      setOptimistic((prev) => prev.map((i) => (i.id === row.id ? { ...i, checked: !i.checked } : i)))
      await toggleItemAction(row.id, !row.checked)
    })
  }

  function complete() {
    start(async () => {
      setOptimistic((prev) => prev.filter((i) => !i.checked))
      try {
        const res = await completeShoppingAction(rid)
        toast.success(
          res.saved > 0
            ? `Done! ${res.saved} food item${res.saved === 1 ? '' : 's'} saved to your Ingredients.`
            : `Done! ${res.cleared} item${res.cleared === 1 ? '' : 's'} cleared.`,
        )
      } catch {
        toast.error('Could not complete the shopping trip. Please try again.')
      }
    })
  }

  function removeRow(id: string) {
    start(async () => {
      setOptimistic((prev) => prev.filter((i) => i.id !== id))
      await removeItemAction(id)
    })
  }

  function renderRow(row: ShoppingListRow) {
    return (
      <li key={row.id} className="flex items-center gap-3 border-b py-2 text-sm">
        <Checkbox checked={row.checked} onCheckedChange={() => toggle(row)} />
        <span className={row.checked ? 'text-muted-foreground line-through' : ''}>{row.name}</span>
        {row.source_recipe_ids.length > 1 && (
          <span className="rounded-full bg-secondary/20 px-2 py-0.5 text-[10px] text-secondary-foreground">
            merged ×{row.source_recipe_ids.length}
          </span>
        )}
        <span className="ml-auto text-muted-foreground">{fmtQty(row.total_quantity)} {row.unit ?? ''}</span>
        <button onClick={() => removeRow(row.id)} className="text-muted-foreground hover:text-destructive">✕</button>
      </li>
    )
  }

  const checkedCount = optimistic.filter((i) => i.checked).length
  const foodItems = optimistic.filter((i) => i.is_food)
  const dailyItems = optimistic.filter((i) => !i.is_food)
  const byAisle = AISLE_ORDER
    .map((aisle) => ({ aisle, rows: foodItems.filter((i) => i.category === aisle) }))
    .filter((g) => g.rows.length > 0)

  return (
    <div className="space-y-5">
      <AddShoppingItem roomId={rid} />

      {optimistic.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="text-lg">Your list is empty.</p>
          <p className="text-sm text-muted-foreground">
            Add an item above, or open a recipe and tap &quot;Add ingredients to shopping list&quot;.
          </p>
        </div>
      ) : (
        <>
          <div>
            <p className="text-xs text-muted-foreground">{checkedCount} of {optimistic.length} items checked</p>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-secondary transition-all"
                style={{ width: `${Math.round((checkedCount / optimistic.length) * 100)}%` }}
              />
            </div>
          </div>

          {foodItems.length > 0 && (
            <div className="space-y-4">
              <h2 className="font-serif text-lg text-primary">🍎 Food</h2>
              {byAisle.map((group) => (
                <section key={group.aisle}>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.aisle}</h3>
                  <ul>{group.rows.map(renderRow)}</ul>
                </section>
              ))}
            </div>
          )}

          {dailyItems.length > 0 && (
            <div className="space-y-1">
              <h2 className="font-serif text-lg text-primary">🧺 Daily &amp; other</h2>
              <ul>{dailyItems.map(renderRow)}</ul>
            </div>
          )}

          {checkedCount > 0 && (
            <Button type="button" onClick={complete}>
              ✓ Done — clear {checkedCount} ticked &amp; save food to Ingredients
            </Button>
          )}
        </>
      )}
    </div>
  )
}
