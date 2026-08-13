// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { mergeIngredients } from '@/lib/merge'

describe('mergeIngredients', () => {
  it('sums same name + same unit and unions recipe ids', () => {
    const out = mergeIngredients([
      { name: 'Garlic', quantity: 4, unit: 'clove', recipeId: 'r1' },
      { name: 'garlic', quantity: 6, unit: 'clove', recipeId: 'r2' },
    ])
    expect(out).toHaveLength(1)
    expect(out[0].totalQuantity).toBe(10)
    expect(out[0].unit).toBe('clove')
    expect(out[0].mergedCount).toBe(2)
    expect(out[0].sourceRecipeIds.sort()).toEqual(['r1', 'r2'])
  })

  it('converts compatible units to the first unit before summing', () => {
    const out = mergeIngredients([
      { name: 'olive oil', quantity: 3, unit: 'tbsp', recipeId: 'r1' },
      { name: 'olive oil', quantity: 1, unit: 'tbsp', recipeId: 'r2' },
      { name: 'olive oil', quantity: 30, unit: 'ml', recipeId: 'r3' },
    ])
    expect(out).toHaveLength(1)
    // 4 tbsp = 59.15 ml, +30 ml -> but base unit is first (tbsp): 4 + 30/14.7868 ≈ 6.03 tbsp
    expect(out[0].unit).toBe('tbsp')
    expect(out[0].totalQuantity).toBeCloseTo(6.03, 1)
    expect(out[0].mergedCount).toBe(3)
  })

  it('splits a group when units are inconvertible', () => {
    const out = mergeIngredients([
      { name: 'flour', quantity: 100, unit: 'g', recipeId: 'r1' },
      { name: 'flour', quantity: 1, unit: 'cup', recipeId: 'r2' },
    ])
    // g (mass) and cup (volume) cannot merge
    expect(out).toHaveLength(2)
  })

  it('keeps null-quantity items as their own rows', () => {
    const out = mergeIngredients([
      { name: 'salt', quantity: null, unit: null, recipeId: 'r1' },
      { name: 'salt', quantity: null, unit: null, recipeId: 'r2' },
    ])
    // same name+unit(null) groups but quantity stays null, count 2
    expect(out).toHaveLength(1)
    expect(out[0].totalQuantity).toBe(null)
    expect(out[0].mergedCount).toBe(2)
  })

  it('splits a null-unit item from a quantified-unit item of the same name', () => {
    const out = mergeIngredients([
      { name: 'salt', quantity: null, unit: null, recipeId: 'r1' },
      { name: 'salt', quantity: 1, unit: 'tsp', recipeId: 'r2' },
    ])
    expect(out).toHaveLength(2)
  })

  it('assigns an aisle and sorts produce before pantry', () => {
    const out = mergeIngredients([
      { name: 'spaghetti', quantity: 200, unit: 'g', recipeId: 'r1' },
      { name: 'tomato', quantity: 3, unit: 'piece', recipeId: 'r1' },
    ])
    expect(out[0].name).toBe('tomato')
    expect(out[0].category).toBe('Produce')
    expect(out[1].category).toBe('Pantry')
  })
})
