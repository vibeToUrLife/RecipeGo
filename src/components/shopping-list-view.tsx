'use client'
import { useOptimistic, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { useT } from '@/components/i18n-provider'
import type { ShoppingListRow } from '@/lib/data/shopping'
import type { Unit } from '@/lib/types'
import { findStackTarget, stackedTotal } from '@/lib/stack'
import { AISLE_ORDER, categorizeIngredient } from '@/lib/aisles'
import { UNIT_GROUPS } from '@/lib/unit-options'
import { toggleItemAction, removeItemAction, completeShoppingAction, addShoppingItemAction, updateItemQuantityAction } from '@/app/shopping-list/actions'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'

function fmtQty(q: number | null) {
  if (q === null) return ''
  return Number.isInteger(q) ? String(q) : q.toFixed(2).replace(/\.?0+$/, '')
}

// Mirror the server's stacking rule so the optimistic list matches what will
// come back after revalidation (no duplicate row flicker on re-add). Only
// unchecked rows of the same kind (food/daily) are eligible to stack onto.
function stackInto(rows: ShoppingListRow[], added: ShoppingListRow): ShoppingListRow[] {
  const eligible = rows.filter((r) => !r.checked && r.is_food === added.is_food)
  const addition = { name: added.name, unit: added.unit, quantity: added.total_quantity }
  const hit = findStackTarget(
    eligible.map((r) => ({ name: r.name, unit: r.unit, totalQuantity: r.total_quantity })),
    addition,
  )
  if (hit === -1) return [...rows, added]
  const match = eligible[hit]
  const total = stackedTotal({ name: match.name, unit: match.unit, totalQuantity: match.total_quantity }, addition)
  return rows.map((r) => (r.id === match.id ? { ...r, total_quantity: total } : r))
}

export function ShoppingListView({ items, roomId }: { items: ShoppingListRow[]; roomId?: string | null }) {
  const t = useT()
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
      toast.info(t('shop.stillAdding'))
      return
    }
    if (v.length > 200) {
      toast.error(t('shop.nameTooLong'))
      return
    }
    const q = qty.trim() === '' ? null : Number(qty)
    if (q !== null && (!Number.isFinite(q) || q < 0 || q > 100000)) {
      toast.error(t('shop.badQty'))
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
        setOptimistic((prev) => stackInto(prev, optimisticRow)) // shows instantly, stacking duplicates
        const res = await addShoppingItemAction(rid, { name: v, isFood, quantity: q, unit: u })
        if (res?.error) toast.error(res.error)
      } catch {
        toast.error(t('shop.addFailed'))
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
            ? t('shop.doneSavedFood', { n: res.saved })
            : t('shop.doneCleared', { n: res.cleared }),
        )
      } catch {
        toast.error(t('shop.completeFailed'))
      }
    })
  }

  function removeRow(id: string) {
    start(async () => {
      setOptimistic((prev) => prev.filter((i) => i.id !== id))
      await removeItemAction(id)
    })
  }

  function setQuantity(id: string, quantity: number | null) {
    start(async () => {
      setOptimistic((prev) => prev.map((i) => (i.id === id ? { ...i, total_quantity: quantity } : i)))
      try {
        const res = await updateItemQuantityAction(id, quantity)
        if (res?.error) toast.error(res.error)
      } catch {
        toast.error(t('shop.qtyUpdateFailed'))
      }
    })
  }

  function renderRow(row: ShoppingListRow) {
    return (
      <li key={row.id} className="flex items-center gap-3 border-b py-2 text-sm">
        <Checkbox checked={row.checked} onCheckedChange={() => toggle(row)} />
        <span className={row.checked ? 'text-muted-foreground line-through' : ''}>{row.name}</span>
        {row.source_recipe_ids.length > 1 && (
          <span className="rounded-full bg-secondary/20 px-2 py-0.5 text-[10px] text-secondary-foreground">
            {t('shop.merged', { n: row.source_recipe_ids.length })}
          </span>
        )}
        <QtyEditor row={row} unitLabel={row.unit ? t('unit.' + row.unit) : ''} onCommit={setQuantity} />
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
            placeholder={t('shop.addPlaceholder')}
            aria-label={t('shop.itemName')}
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
            placeholder={t('form.qty')}
            aria-label={t('shop.quantityAria')}
            className="w-20"
          />
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            aria-label={t('shop.unitAria')}
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
          >
            <option value="">{t('form.unit')}</option>
            {UNIT_GROUPS.map((g) => (
              <optgroup key={g.label} label={t('unitGroup.' + g.label)}>
                {g.units.map((u) => (
                  <option key={u} value={u}>{t('unit.' + u)}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as 'food' | 'other')}
            aria-label={t('shop.itemTypeAria')}
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
          >
            <option value="food">{t('shop.food')}</option>
            <option value="other">{t('shop.daily')}</option>
          </select>
          <Button type="button" onClick={submitAdd} disabled={adding} className="shrink-0">
            <Plus className="size-4" /> {adding ? t('shop.adding') : t('common.add')}
          </Button>
        </div>
      </div>

      {optimistic.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="text-lg">{t('shop.empty')}</p>
          <p className="text-sm text-muted-foreground">
            {t('shop.emptyHint')}
          </p>
        </div>
      ) : (
        <>
          <div>
            <p className="text-xs text-muted-foreground">{t('shop.checkedOf', { checked: checkedCount, total: optimistic.length })}</p>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-secondary transition-all"
                style={{ width: `${Math.round((checkedCount / optimistic.length) * 100)}%` }}
              />
            </div>
          </div>

          {foodItems.length > 0 && (
            <div className="space-y-4">
              <h2 className="font-serif text-lg text-primary">{t('shop.foodHeading')}</h2>
              {byAisle.map((group) => (
                <section key={group.aisle}>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('aisle.' + group.aisle)}</h3>
                  <ul>{group.rows.map(renderRow)}</ul>
                </section>
              ))}
            </div>
          )}

          {dailyItems.length > 0 && (
            <div className="space-y-1">
              <h2 className="font-serif text-lg text-primary">{t('shop.dailyHeading')}</h2>
              <ul>{dailyItems.map(renderRow)}</ul>
            </div>
          )}

          {checkedCount > 0 && (
            <Button type="button" onClick={complete}>
              {t('shop.done', { n: checkedCount })}
            </Button>
          )}
        </>
      )}
    </div>
  )
}

// Inline, editable quantity for a row. Commits on blur or Enter; Escape reverts.
// An empty field clears the quantity (unspecified). The unit is shown but not
// editable here.
function QtyEditor({
  row,
  unitLabel,
  onCommit,
}: {
  row: ShoppingListRow
  unitLabel: string
  onCommit: (id: string, quantity: number | null) => void
}) {
  const t = useT()
  const [val, setVal] = useState(fmtQty(row.total_quantity))
  // Re-sync the field when the row's quantity changes elsewhere (stacking a
  // duplicate, a server revalidation, or reverting a rejected edit).
  const [synced, setSynced] = useState(row.total_quantity)
  if (synced !== row.total_quantity) {
    setSynced(row.total_quantity)
    setVal(fmtQty(row.total_quantity))
  }

  function commit() {
    const raw = val.trim()
    const q = raw === '' ? null : Number(raw)
    if (q !== null && (!Number.isFinite(q) || q < 0 || q > 100000)) {
      setVal(fmtQty(row.total_quantity)) // reject invalid input, restore stored value
      toast.error(t('shop.badQty'))
      return
    }
    const next = q === null ? null : Math.round(q * 100) / 100
    if (next === row.total_quantity) {
      setVal(fmtQty(row.total_quantity)) // normalise display (e.g. "3.0" -> "3")
      return
    }
    onCommit(row.id, next)
  }

  return (
    <span className="ml-auto flex items-center gap-1 text-muted-foreground">
      <Input
        type="number"
        inputMode="decimal"
        min="0"
        step="any"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            e.currentTarget.blur()
          } else if (e.key === 'Escape') {
            setVal(fmtQty(row.total_quantity))
            e.currentTarget.blur()
          }
        }}
        aria-label={t('shop.editQtyAria')}
        className="h-7 w-16 px-2 py-0 text-right"
      />
      {unitLabel && <span className="min-w-8">{unitLabel}</span>}
    </span>
  )
}
