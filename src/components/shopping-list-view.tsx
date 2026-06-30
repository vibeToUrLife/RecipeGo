'use client'
import { useOptimistic, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { useT } from '@/components/i18n-provider'
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
        setOptimistic((prev) => [...prev, optimisticRow]) // shows instantly
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
