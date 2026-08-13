// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { parseIngredientLine } from '../parse-ingredient'

describe('parseIngredientLine', () => {
  it('parses attached unit (200g flour)', () => {
    expect(parseIngredientLine('200g flour')).toEqual({ quantity: 200, unit: 'g', name: 'flour' })
  })
  it('parses spaced unit (200 g flour)', () => {
    expect(parseIngredientLine('200 g flour')).toEqual({ quantity: 200, unit: 'g', name: 'flour' })
  })
  it('parses cloves', () => {
    expect(parseIngredientLine('2 cloves garlic')).toEqual({ quantity: 2, unit: 'clove', name: 'garlic' })
  })
  it('parses fraction (1/2 cup sugar)', () => {
    expect(parseIngredientLine('1/2 cup sugar')).toEqual({ quantity: 0.5, unit: 'cup', name: 'sugar' })
  })
  it('parses tablespoon abbreviation', () => {
    expect(parseIngredientLine('3 tbsp olive oil')).toEqual({ quantity: 3, unit: 'tbsp', name: 'olive oil' })
  })
  it('parses decimal (1.5 kg potatoes)', () => {
    expect(parseIngredientLine('1.5 kg potatoes')).toEqual({ quantity: 1.5, unit: 'kg', name: 'potatoes' })
  })
  it('parses mixed number (1 1/2 cups flour)', () => {
    expect(parseIngredientLine('1 1/2 cups flour')).toEqual({ quantity: 1.5, unit: 'cup', name: 'flour' })
  })
  it('parses quantity without known unit (2 eggs)', () => {
    expect(parseIngredientLine('2 eggs')).toEqual({ quantity: 2, unit: null, name: 'eggs' })
  })
  it('returns raw line when no leading number (Salt to taste)', () => {
    expect(parseIngredientLine('Salt to taste')).toEqual({ quantity: null, unit: null, name: 'Salt to taste' })
  })
})
