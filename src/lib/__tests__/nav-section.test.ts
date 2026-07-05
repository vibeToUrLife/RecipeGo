import { describe, it, expect } from 'vitest'
import { roomSectionKey, personalSectionKey } from '@/lib/nav-section'

describe('roomSectionKey', () => {
  const room = 'r1'
  it('maps each room sub-page to its section key', () => {
    expect(roomSectionKey('/rooms/r1', room)).toBe('nav.recipes')
    expect(roomSectionKey('/rooms/r1/members', room)).toBe('rooms.members')
    expect(roomSectionKey('/rooms/r1/cook', room)).toBe('nav.ingredients')
    expect(roomSectionKey('/rooms/r1/shopping-list', room)).toBe('nav.shoppingList')
    expect(roomSectionKey('/rooms/r1/plan', room)).toBe('nav.plan')
  })
  it('falls back to the recipe library for the home, spin, or an unknown page', () => {
    expect(roomSectionKey('/rooms/r1/spin', room)).toBe('nav.recipes')
    expect(roomSectionKey('/recipes/xyz', room)).toBe('nav.recipes')
  })
})

describe('personalSectionKey', () => {
  it('maps personal sub-pages, and returns null for the recipes home', () => {
    expect(personalSectionKey('/')).toBeNull()
    expect(personalSectionKey('/cook')).toBe('nav.ingredients')
    expect(personalSectionKey('/shopping-list')).toBe('nav.shoppingList')
    expect(personalSectionKey('/plan')).toBe('nav.plan')
    expect(personalSectionKey('/recipes/xyz')).toBeNull()
  })
})
