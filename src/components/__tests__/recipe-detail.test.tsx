import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { RecipeDetail } from '@/components/recipe-detail'
import type { RecipeWithChildren } from '@/lib/db-types'

// The action buttons all reach for a router and server actions; none of that
// matters to what prints, so stub them.
vi.mock('@/components/i18n-provider', () => ({ useT: () => (k: string) => k }))
vi.mock('@/components/add-to-list-button', () => ({ AddToListButton: () => null }))
vi.mock('@/components/delete-recipe-button', () => ({ DeleteRecipeButton: () => null }))
vi.mock('@/components/share-recipe-button', () => ({ ShareRecipeButton: () => null }))

const recipe: RecipeWithChildren = {
  id: 'r1',
  user_id: 'u1',
  title: 'Miso Soup',
  description: null,
  image_path: null,
  servings: 2,
  prep_minutes: 5,
  cook_minutes: 10,
  difficulty: 'easy',
  source_url: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  room_id: null,
  ingredients: [
    { id: 'i1', recipe_id: 'r1', name: 'miso paste', quantity: 2, unit: 'tbsp', category: 'Pantry', position: 0 },
  ],
  steps: [{ id: 's1', recipe_id: 'r1', step_number: 1, text: 'Whisk the miso in.', image_path: null }],
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('RecipeDetail print/PDF', () => {
  it('prints the recipe on demand', async () => {
    const print = vi.fn()
    vi.stubGlobal('print', print)

    render(<RecipeDetail recipe={recipe} />)
    await userEvent.click(screen.getByRole('button', { name: 'print.recipe' }))

    expect(print).toHaveBeenCalledTimes(1)
  })

  it('swaps the servings stepper for the plain number it settled on', async () => {
    render(<RecipeDetail recipe={recipe} />)
    // Quantities are scaled to the stepper, so the printout has to say which
    // servings count they were scaled to — the stepper itself is screen-only.
    const printed = screen.getByText(/detail\.servings:/)
    expect(printed).toHaveClass('print:block')
    expect(printed).toHaveTextContent('detail.servings: 2')

    await userEvent.click(screen.getByRole('button', { name: '＋' }))
    expect(printed).toHaveTextContent('detail.servings: 3')
  })
})
