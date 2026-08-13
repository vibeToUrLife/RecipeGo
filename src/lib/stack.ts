import type { Unit } from '@/lib/types'
import { canConvert, convert } from '@/lib/units'

const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ')

export interface StackTarget {
  name: string
  unit: Unit
  totalQuantity: number | null
}

export interface StackAddition {
  name: string
  unit: Unit
  quantity: number | null
}

// Index of the existing row a newly-added item should stack onto, or -1 when it
// has no home and should become its own row. Rows stack when they share a
// (normalised) name and either the same unit, or convertible units where both
// sides carry a numeric quantity (counts like "piece" never convert).
export function findStackTarget(rows: StackTarget[], added: StackAddition): number {
  const key = norm(added.name)
  return rows.findIndex((r) => {
    if (norm(r.name) !== key) return false
    if (r.unit === added.unit) return true
    if (added.quantity === null || r.totalQuantity === null) return false
    return canConvert(r.unit, added.unit)
  })
}

// The total after stacking `added` onto `target`. Quantities sum when both are
// numeric (converting into the target's unit as needed); a null on either side
// means "unspecified" and leaves the target's total untouched.
export function stackedTotal(target: StackTarget, added: StackAddition): number | null {
  if (added.quantity === null || target.totalQuantity === null) return target.totalQuantity
  const add = target.unit === added.unit
    ? added.quantity
    : convert(added.quantity, added.unit, target.unit)
  return Math.round((target.totalQuantity + add) * 100) / 100
}
