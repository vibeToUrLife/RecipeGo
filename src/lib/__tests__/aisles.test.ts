// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { categorizeIngredient, AISLE_ORDER } from '@/lib/aisles'

describe('categorizeIngredient', () => {
  it('maps produce items', () => {
    expect(categorizeIngredient('Tomato')).toBe('Produce')
    expect(categorizeIngredient('2 cloves garlic')).toBe('Produce')
    expect(categorizeIngredient('fresh spinach')).toBe('Produce')
  })
  it('maps dairy & eggs', () => {
    expect(categorizeIngredient('Parmesan cheese')).toBe('Dairy & Eggs')
    expect(categorizeIngredient('large eggs')).toBe('Dairy & Eggs')
    expect(categorizeIngredient('whole milk')).toBe('Dairy & Eggs')
  })
  it('maps meat & seafood', () => {
    expect(categorizeIngredient('chicken breast')).toBe('Meat & Seafood')
    expect(categorizeIngredient('salmon fillet')).toBe('Meat & Seafood')
  })
  it('maps pantry staples', () => {
    expect(categorizeIngredient('spaghetti')).toBe('Pantry')
    expect(categorizeIngredient('olive oil')).toBe('Pantry')
  })
  it('maps spices', () => {
    expect(categorizeIngredient('ground cumin')).toBe('Spices')
  })
  it('defaults unknown to Other', () => {
    expect(categorizeIngredient('moon dust')).toBe('Other')
  })
  it('AISLE_ORDER ends with Other and starts with Produce', () => {
    expect(AISLE_ORDER[0]).toBe('Produce')
    expect(AISLE_ORDER[AISLE_ORDER.length - 1]).toBe('Other')
  })
})
