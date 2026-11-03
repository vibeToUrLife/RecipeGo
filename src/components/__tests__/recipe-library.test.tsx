import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { RecipeLibrary } from '@/components/recipe-library'
import type { Recipe } from '@/lib/db-types'

vi.mock('@/components/i18n-provider', () => ({ useT: () => (k: string) => k }))
vi.mock('@/components/recipe-card', () => ({ RecipeCard: ({ recipe }: { recipe: Recipe }) => <p>{recipe.title}</p> }))

const recipes = [
  { id: 'r1', title: 'Roast Chicken' },
  { id: 'r2', title: 'Lemon Soup' },
] as Recipe[]

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

  it('still narrows the recipes as you type', () => {
    render(<RecipeLibrary recipes={recipes} />)
    fireEvent.change(screen.getByPlaceholderText('home.searchPlaceholder'), { target: { value: 'soup' } })
    expect(screen.queryByText('Roast Chicken')).toBeNull()
    expect(screen.getByText('Lemon Soup')).toBeInTheDocument()
  })
})
