'use client'
import { useOptimistic, useTransition } from 'react'
import Link from 'next/link'
import type { ShoppingListRow } from '@/lib/data/shopping'
import { AISLE_ORDER } from '@/lib/aisles'
import { toggleItemAction, removeItemAction, clearCheckedAction } from '@/app/shopping-list/actions'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'

function fmtQty(q: number | null) {
  if (q === null) return ''
  return Number.isInteger(q) ? String(q) : q.toFixed(2).replace(/\.?0+$/, '')
}

export function ShoppingListView({ items }: { items: ShoppingListRow[] }) {
  const [optimistic, setOptimistic] = useOptimistic(items)
  const [, start] = useTransition()

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <p className="text-lg">Your list is empty.</p>
        <p className="mb-4 text-sm text-muted-foreground">Open a recipe and tap "Add ingredients to shopping list".</p>
        <Button asChild><Link href="/">Browse recipes</Link></Button>
      </div>
    )
  }

  const checkedCount = optimistic.filter((i) => i.checked).length
  const pct = Math.round((checkedCount / optimistic.length) * 100)
  const byAisle = AISLE_ORDER
    .map((aisle) => ({ aisle, rows: optimistic.filter((i) => i.category === aisle) }))
    .filter((g) => g.rows.length > 0)

  function toggle(row: ShoppingListRow) {
    start(async () => {
      setOptimistic((prev) => prev.map((i) => (i.id === row.id ? { ...i, checked: !i.checked } : i)))
      await toggleItemAction(row.id, !row.checked)
    })
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-muted-foreground">{checkedCount} of {optimistic.length} items checked</p>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-secondary transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {byAisle.map((group) => (
        <section key={group.aisle}>
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">{group.aisle}</h2>
          <ul>
            {group.rows.map((row) => (
              <li key={row.id} className="flex items-center gap-3 border-b py-2 text-sm">
                <Checkbox checked={row.checked} onCheckedChange={() => toggle(row)} />
                <span className={row.checked ? 'text-muted-foreground line-through' : ''}>{row.name}</span>
                {row.source_recipe_ids.length > 1 && (
                  <span className="rounded-full bg-secondary/20 px-2 py-0.5 text-[10px] text-secondary-foreground">merged ×{row.source_recipe_ids.length}</span>
                )}
                <span className="ml-auto text-muted-foreground">{fmtQty(row.total_quantity)} {row.unit ?? ''}</span>
                <button onClick={() => start(() => removeItemAction(row.id))} className="text-muted-foreground hover:text-destructive">✕</button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {checkedCount > 0 && (
        <form action={clearCheckedAction}>
          <Button type="submit" variant="outline" size="sm">Clear {checkedCount} checked item(s)</Button>
        </form>
      )}
    </div>
  )
}
