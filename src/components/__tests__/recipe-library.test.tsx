import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { RecipeLibrary } from '@/components/recipe-library'
import type { LibraryRecipe } from '@/lib/db-types'

vi.mock('@/components/i18n-provider', () => ({
  useT: () => (k: string, vars?: Record<string, string>) => (vars?.name ? `${k}:${vars.name}` : k),
}))
// The title, then the card's hint in brackets when it has one.
vi.mock('@/components/recipe-card', () => ({
  RecipeCard: ({ recipe, hint }: { recipe: LibraryRecipe; hint?: string }) => <p>{recipe.title}{hint && ` (${hint})`}</p>,
}))

const recipes = [
  { id: 'r1', title: 'Roast Chicken', ingredient_names: ['chicken', 'lemon'] },
  { id: 'r2', title: 'Lemon Soup', ingredient_names: ['lemon', 'Chicken stock'] },
  { id: 'r3', title: 'Steamed Rice', ingredient_names: ['rice'] },
] as LibraryRecipe[]
const search = (q: string) => fireEvent.change(screen.getByPlaceholderText('home.searchPlaceholder'), { target: { value: q } })
const shown = () => screen.queryAllByText(/Roast|Lemon|Rice/).map((p) => p.textContent)

const toolbar = () => screen.getByPlaceholderText('home.searchPlaceholder').parentElement!.parentElement!

afterEach(() => { document.querySelectorAll('body > header, body > nav').forEach((el) => el.remove()) })

describe('RecipeLibrary search', () => {
  it('stays pinned just under the header and the pill row pinned there', () => {
    // What's pinned to the top: a 61px header, and a 44px pill row under it.
    document.body.insertAdjacentHTML('afterbegin',
      '<header style="position: sticky; top: 0px"></header><nav style="position: sticky; top: 61px"></nav>')
    Object.defineProperty(document.querySelector('header'), 'offsetHeight', { value: 61 })
    Object.defineProperty(document.querySelector('nav'), 'offsetHeight', { value: 44 })

    render(<RecipeLibrary recipes={recipes} />)
    expect(toolbar()).toHaveClass('sticky')
    expect(toolbar()).toHaveStyle({ top: '105px' })
  })

  it('keeps the search and its buttons to one line, so pinned it stays one row tall', () => {
    render(<RecipeLibrary recipes={recipes} />)
    expect(toolbar()).not.toHaveClass('flex-wrap')
    expect(toolbar()).toContainElement(screen.getByText('lib.addRecipe').closest('a'))
  })

  it('still narrows the recipes by name as you type', () => {
    render(<RecipeLibrary recipes={recipes} />)
    search('soup')
    expect(shown()).toEqual(['Lemon Soup'])
  })

  it('finds a recipe by one of its ingredients, saying which', () => {
    render(<RecipeLibrary recipes={recipes} />)
    search('chicken')
    // Roast Chicken by its name, so nothing to explain; the soup by its stock.
    expect(shown()).toEqual(['Roast Chicken', 'Lemon Soup (home.usesIngredient:Chicken stock)'])
  })

  it('ignores case and the spaces around what you type', () => {
    render(<RecipeLibrary recipes={recipes} />)
    search('  RICE ')
    expect(shown()).toEqual(['Steamed Rice'])
  })
})
