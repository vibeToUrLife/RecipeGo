// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { matchRecipes, ingredientUniverse, normalizeIng, type RecipeIngredients } from '@/lib/cook/match'

const recipes: RecipeIngredients[] = [
  { id: 'a', title: 'Pancakes', room_id: null, ingredients: ['Flour', 'Milk', 'Egg'] },
  { id: 'b', title: 'Omelette', room_id: null, ingredients: ['Egg', 'Butter', 'Salt'] },
  { id: 'c', title: 'Toast', room_id: 'r1', ingredients: ['Bread'] },
  { id: 'd', title: 'No ingredients', room_id: null, ingredients: [] },
]

describe('normalizeIng', () => {
  it('lowercases and trims', () => {
    expect(normalizeIng('  Flour ')).toBe('flour')
  })
})

describe('ingredientUniverse', () => {
  it('returns distinct names (case-insensitive), sorted, with first-seen display casing', () => {
    const u = ingredientUniverse(recipes)
    expect(u).toEqual(['Bread', 'Butter', 'Egg', 'Flour', 'Milk', 'Salt'])
  })

  it('dedupes across recipes regardless of casing', () => {
    const u = ingredientUniverse([
      { id: '1', title: 'x', room_id: null, ingredients: ['Egg'] },
      { id: '2', title: 'y', room_id: null, ingredients: ['egg', 'EGG'] },
    ])
    expect(u).toEqual(['Egg'])
  })
})

describe('matchRecipes', () => {
  it('puts fully-covered recipes in ready', () => {
    const { ready } = matchRecipes(recipes, ['flour', 'milk', 'egg', 'bread'])
    expect(ready.map((r) => r.id).sort()).toEqual(['a', 'c'])
  })

  it('puts recipes missing 1–3 ingredients in almost, with the missing list', () => {
    const { almost } = matchRecipes(recipes, ['egg'])
    const omelette = almost.find((r) => r.id === 'b')
    expect(omelette).toBeTruthy()
    expect(omelette!.missing.sort()).toEqual(['butter', 'salt'])
    expect(omelette!.total).toBe(3)
  })

  it('is case-insensitive when matching what you have', () => {
    const { ready } = matchRecipes([recipes[2]], ['BREAD'])
    expect(ready.map((r) => r.id)).toEqual(['c'])
  })

  it('skips recipes that have no ingredients', () => {
    const { ready, almost } = matchRecipes(recipes, ['flour', 'milk', 'egg', 'butter', 'salt', 'bread'])
    expect([...ready, ...almost].some((r) => r.id === 'd')).toBe(false)
  })

  it('does not show a recipe in almost when you have none of its ingredients', () => {
    // empty pantry → nothing is "almost", even small recipes
    const { almost } = matchRecipes(recipes, [])
    expect(almost).toHaveLength(0)
    // a 1-ingredient recipe you have none of is also excluded
    const { almost: a2 } = matchRecipes(recipes, ['egg'])
    expect(a2.some((r) => r.id === 'c')).toBe(false) // Toast (bread) — you have 0 of it
  })

  it('excludes recipes missing more than 3 ingredients', () => {
    const big: RecipeIngredients = { id: 'big', title: 'Big', room_id: null, ingredients: ['a', 'b', 'c', 'd', 'e'] }
    const { ready, almost } = matchRecipes([big], ['a'])
    expect(ready).toHaveLength(0)
    expect(almost).toHaveLength(0)
  })

  it('sorts almost by fewest missing first', () => {
    const rs: RecipeIngredients[] = [
      { id: 'two', title: 'Two', room_id: null, ingredients: ['a', 'b', 'c'] },
      { id: 'one', title: 'One', room_id: null, ingredients: ['a', 'b'] },
    ]
    const { almost } = matchRecipes(rs, ['a'])
    expect(almost.map((r) => r.id)).toEqual(['one', 'two'])
  })
})
