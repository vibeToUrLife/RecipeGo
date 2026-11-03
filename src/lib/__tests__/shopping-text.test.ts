import { describe, it, expect } from 'vitest'
import { shoppingListText, fmtQty } from '@/lib/shopping-text'
import type { ShoppingListRow } from '@/lib/data/shopping'

const row = (over: Partial<ShoppingListRow>): ShoppingListRow => ({
  id: 'i', name: 'carrot', total_quantity: null, unit: null, category: 'Produce',
  checked: false, source_recipe_ids: [], is_food: true, room_id: null, ...over,
})
// Labels as the keys' last part, e.g. 'aisle.Produce' -> 'Produce', 'unit.g' -> 'g'.
const t = (k: string) => k.split('.').pop()!

describe('shoppingListText', () => {
  it('lists what is left by aisle in the list’s order, then everyday things', () => {
    const text = shoppingListText([
      row({ id: '1', name: 'milk', category: 'Dairy & Eggs', total_quantity: 1, unit: 'l' }),
      row({ id: '2', name: 'carrot', category: 'Produce', total_quantity: 3 }),
      row({ id: '3', name: 'tissues', is_food: false, category: 'Other' }),
      row({ id: '4', name: 'chicken', category: 'Meat & Seafood', total_quantity: 0.5, unit: 'kg' }),
    ], t)
    expect(text).toBe([
      'title',
      'Produce\n- carrot 3',
      'Meat & Seafood\n- chicken 0.5 kg',
      'Dairy & Eggs\n- milk 1 l',
      'dailyHeading\n- tissues',
    ].join('\n\n'))
  })

  it('leaves out what’s ticked, since it’s bought', () => {
    const text = shoppingListText([row({ id: '1', name: 'carrot' }), row({ id: '2', name: 'leek', checked: true })], t)
    expect(text).toContain('- carrot')
    expect(text).not.toContain('leek')
  })
})

describe('fmtQty', () => {
  it('shows a quantity without trailing zeros', () => {
    expect([fmtQty(2), fmtQty(0.5), fmtQty(1.25), fmtQty(1 / 3), fmtQty(null)]).toEqual(['2', '0.5', '1.25', '0.33', ''])
  })
})
