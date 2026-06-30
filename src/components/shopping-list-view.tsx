'use client'
import { useOptimistic, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import type { ShoppingListRow } from '@/lib/data/shopping'
import type { Unit } from '@/lib/types'
import { AISLE_ORDER, categorizeIngredient } from '@/lib/aisles'
import { UNIT_GROUPS } from '@/lib/unit-options'
import { toggleItemAction, removeItemAction, completeShoppingAction, addShoppingItemAction } from '@/app/shopping-list/actions'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'

function fmtQty(q: number | null) {
  if (q === null) return ''
  return Number.isInteger(q) ? String(q) : q.toFixed(2).replace(/\.?0+$/, '')
}

export function ShoppingListView({ items, roomId }: { items: ShoppingListRow[]; roomId?: string | null }) {
  const [optimistic, setOptimistic] = useOptimistic(items)
  const [, start] = useTransition()
  const rid = roomId ?? null

  // Add-item form state
  const [name, setName] = useState('')
  const [qty, setQty] = useState('')
  const [unit, setUnit] = useState('')
  const [kind, setKind] = useState<'food' | 'other'>('food')
  const [adding, setAdding] = useState(false)
  const addingRef = useRef(false) // synchronous guard against double-submit

  function submitAdd() {
    const v = name.trim()
    if (!v) return // empty: nothing to add (silent)
    if (addingRef.current) {
      // re-entrant (e.g. Enter mashed while the previous add is in flight)
      toast.info('Still adding the previous item — one sec.')
      return
    }
    if (v.length > 200) {
      toast.error('Name too long (max 200 characters).')
      return
    }
    const q = qty.trim() === '' ? null : Number(qty)
    if (q !== null && (!Number.isFinite(q) || q < 0 || q > 100000)) {
      toast.error('Enter a valid quantity.')
      return
    }
    addingRef.current = true
    setAdding(true)
    const u = (unit === '' ? null : unit) as Unit
    const isFood = kind === 'food'
    // clear the text fields right away so the next item can be typed immediately
    setName('')
    setQty('')
    const optimisticRow: ShoppingListRow = {
      id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: v,
      total_quantity: q,
      unit: u,
      category: isFood ? categorizeIngredient(v) : 'Other',
      checked: false,
      source_recipe_ids: [],
      is_food: isFood,
      room_id: rid,
    }
    start(async () => {
      try {
        setOptimistic((prev) => [...prev, optimisticRow]) // shows instantly
        const res = await addShoppingItemAction(rid, { name: v, isFood, quantity: q, unit: u })
        if (res?.error) toast.error(res.error)
      } catch {
        toast.error('Could not add the item. Please try again.')
      } finally {
        addingRef.current = false
        setAdding(false)
      }
    })
  }

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
      {/* Add an extra item (name + optional quantity/unit + food/daily) */}
      <div className="rounded-xl border border-dashed p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submitAdd()
              }
            }}
            placeholder="Add an extra item — e.g. milk, toilet paper"
            aria-label="Item name"
            className="min-w-[10rem] flex-1"
          />
          <Input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submitAdd()
              }
            }}
            placeholder="Qty"
            aria-label="Quantity"
            className="w-20"
          />
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            aria-label="Unit"
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
          >
            <option value="">unit</option>
            {UNIT_GROUPS.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.units.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as 'food' | 'other')}
            aria-label="Item type"
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
          >
            <option value="food">🍎 Food</option>
            <option value="other">🧺 Daily / other</option>
          </select>
          <Button type="button" onClick={submitAdd} disabled={adding} className="shrink-0">
            <Plus className="size-4" /> {adding ? 'Adding…' : 'Add'}
          </Button>
        </div>
      </div>

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
