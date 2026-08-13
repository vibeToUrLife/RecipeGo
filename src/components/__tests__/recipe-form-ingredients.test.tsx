import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { RecipeForm } from '@/components/recipe-form'
import type { RecipeWithChildren } from '@/lib/db-types'

// Same stubs the step tests use — the server action and the Supabase-backed
// uploader are irrelevant to keyboard flow through the ingredient rows.
vi.mock('@/app/recipes/actions', () => ({ saveRecipe: vi.fn() }))
vi.mock('@/components/image-upload', () => ({ ImageUpload: () => null }))
vi.mock('@/components/i18n-provider', () => ({ useT: () => (k: string) => k }))

const recipe = (names: string[]): RecipeWithChildren => ({
  id: 'r1',
  user_id: 'u1',
  title: 'Roast Chicken',
  description: null,
  image_path: null,
  servings: 2,
  prep_minutes: null,
  cook_minutes: null,
  difficulty: null,
  source_url: null,
  created_at: '2026-07-18T00:00:00Z',
  updated_at: '2026-07-18T00:00:00Z',
  room_id: null,
  ingredients: names.map((name, i) => ({
    id: `i${i}`, recipe_id: 'r1', name, quantity: null, unit: null, category: 'Other' as const, position: i,
  })),
  steps: [],
})

const nameFields = () => screen.getAllByPlaceholderText('form.ingredientName') as HTMLInputElement[]
const qtyFields = () => screen.getAllByPlaceholderText('form.qty') as HTMLInputElement[]

describe('RecipeForm ingredient Enter key', () => {
  it('adds a row and lands the cursor in it when Enter is pressed on the last one', async () => {
    render(<RecipeForm recipe={recipe(['flour'])} rooms={[]} />)
    expect(nameFields()).toHaveLength(1)

    await userEvent.click(nameFields()[0])
    await userEvent.keyboard('{Enter}')

    await waitFor(() => expect(nameFields()).toHaveLength(2))
    // Straight into the new row — no reaching for the mouse.
    expect(nameFields()[1]).toHaveFocus()
    // The row that was typed keeps its text.
    expect(nameFields()[0]).toHaveValue('flour')
  })

  it('moves to the existing next row instead of adding one', async () => {
    render(<RecipeForm recipe={recipe(['flour', 'butter'])} rooms={[]} />)

    await userEvent.click(nameFields()[0])
    await userEvent.keyboard('{Enter}')

    await waitFor(() => expect(nameFields()[1]).toHaveFocus())
    expect(nameFields()).toHaveLength(2)
  })

  it('will not stack up blank rows when Enter is held on an empty last row', async () => {
    // A fresh recipe opens with one blank ingredient row.
    render(<RecipeForm rooms={[]} />)
    expect(nameFields()).toHaveLength(1)

    await userEvent.click(nameFields()[0])
    await userEvent.keyboard('{Enter}{Enter}{Enter}')

    expect(nameFields()).toHaveLength(1)
  })

  it('carries on from the quantity box to the name beside it', async () => {
    render(<RecipeForm recipe={recipe(['flour'])} rooms={[]} />)

    await userEvent.click(qtyFields()[0])
    await userEvent.keyboard('{Enter}')

    // Same row's name, not the next ingredient — that row isn't finished yet.
    await waitFor(() => expect(nameFields()[0]).toHaveFocus())
    expect(nameFields()).toHaveLength(1)
  })

  it('does not submit the form on Enter in an ingredient row', async () => {
    const onSubmit = vi.fn((e: Event) => e.preventDefault())
    render(<RecipeForm recipe={recipe(['flour'])} rooms={[]} />)
    nameFields()[0].closest('form')!.addEventListener('submit', onSubmit)

    await userEvent.click(nameFields()[0])
    await userEvent.keyboard('{Enter}')

    await waitFor(() => expect(nameFields()).toHaveLength(2))
    // Implicit submission is what Enter used to do here — typing an ingredient
    // and hitting Enter would have saved the whole recipe.
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
