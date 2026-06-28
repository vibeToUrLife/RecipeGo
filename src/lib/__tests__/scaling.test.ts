// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { scaleIngredients } from '@/lib/scaling'
import type { IngredientInput } from '@/lib/types'

const base: IngredientInput[] = [
  { name: 'spaghetti', quantity: 200, unit: 'g' },
  { name: 'garlic', quantity: 4, unit: 'clove' },
  { name: 'salt', quantity: null, unit: null },
]

describe('scaleIngredients', () => {
  it('doubles quantities from 4 to 8 servings', () => {
    const out = scaleIngredients(base, 4, 8)
    expect(out[0].quantity).toBe(400)
    expect(out[1].quantity).toBe(8)
  })
  it('halves quantities and rounds to 2 decimals', () => {
    const out = scaleIngredients([{ name: 'oil', quantity: 3, unit: 'tbsp' }], 4, 3)
    expect(out[0].quantity).toBeCloseTo(2.25, 5)
  })
  it('leaves null quantities untouched', () => {
    const out = scaleIngredients(base, 4, 8)
    expect(out[2].quantity).toBe(null)
  })
  it('does not mutate the input', () => {
    const copy = structuredClone(base)
    scaleIngredients(base, 4, 8)
    expect(base).toEqual(copy)
  })
  it('throws on non-positive fromServings', () => {
    expect(() => scaleIngredients(base, 0, 4)).toThrow()
  })
})
