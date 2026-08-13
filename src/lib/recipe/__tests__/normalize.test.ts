// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { parseDurationToMinutes, normalizeInstructions, normalizeRecipe } from '@/lib/recipe/normalize'

describe('parseDurationToMinutes', () => {
  it('parses PT25M and PT1H30M', () => {
    expect(parseDurationToMinutes('PT25M')).toBe(25)
    expect(parseDurationToMinutes('PT1H30M')).toBe(90)
  })
  it('returns undefined for junk', () => {
    expect(parseDurationToMinutes('soon')).toBeUndefined()
    expect(parseDurationToMinutes(42)).toBeUndefined()
  })
})

describe('normalizeInstructions', () => {
  it('handles a string', () => {
    expect(normalizeInstructions('Mix.\nBake.')).toEqual(['Mix.', 'Bake.'])
  })
  it('handles HowToStep array', () => {
    expect(normalizeInstructions([{ '@type': 'HowToStep', text: 'Stir' }, { '@type': 'HowToStep', text: 'Serve' }]))
      .toEqual(['Stir', 'Serve'])
  })
  it('flattens HowToSection', () => {
    const out = normalizeInstructions([
      { '@type': 'HowToSection', itemListElement: [{ '@type': 'HowToStep', text: 'A' }, { '@type': 'HowToStep', text: 'B' }] },
    ])
    expect(out).toEqual(['A', 'B'])
  })
})

describe('normalizeRecipe', () => {
  it('maps core fields', () => {
    const out = normalizeRecipe({
      name: 'Soup',
      image: { url: 'http://img/x.jpg' },
      recipeYield: '4 servings',
      prepTime: 'PT10M',
      cookTime: 'PT20M',
      recipeIngredient: ['1 onion', '500ml stock'],
      recipeInstructions: ['Chop', 'Simmer'],
    }, 'http://src')
    expect(out.name).toBe('Soup')
    expect(out.image).toBe('http://img/x.jpg')
    expect(out.servings).toBe(4)
    expect(out.prepMinutes).toBe(10)
    expect(out.cookMinutes).toBe(20)
    expect(out.ingredients).toHaveLength(2)
    expect(out.instructions).toEqual(['Chop', 'Simmer'])
    expect(out.sourceUrl).toBe('http://src')
  })
})
