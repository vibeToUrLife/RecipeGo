import { AISLE_ORDER } from '@/lib/aisles'
import type { ShoppingListRow } from '@/lib/data/shopping'

// A quantity as the list shows it: 2, 0.5, 1.25 — no trailing zeros.
export function fmtQty(q: number | null) {
  if (q === null) return ''
  return Number.isInteger(q) ? String(q) : q.toFixed(2).replace(/\.?0+$/, '')
}

// What's left to buy, as plain text to send to someone: food by aisle in the
// list's order, then everyday things, each "- name quantity unit". What's
// ticked is bought already, so it's left out.
export function shoppingListText(rows: ShoppingListRow[], t: (key: string) => string): string {
  const left = rows.filter((r) => !r.checked)
  const line = (r: ShoppingListRow) =>
    `- ${[r.name, fmtQty(r.total_quantity), r.unit ? t('unit.' + r.unit) : ''].filter(Boolean).join(' ')}`
  const groups = [
    ...AISLE_ORDER.map((aisle) => ({ heading: t('aisle.' + aisle), rows: left.filter((r) => r.is_food && r.category === aisle) })),
    { heading: t('shop.dailyHeading'), rows: left.filter((r) => !r.is_food) },
  ]
  return [t('shop.title'), ...groups.filter((g) => g.rows.length > 0).map((g) => `${g.heading}\n${g.rows.map(line).join('\n')}`)]
    .join('\n\n')
}
