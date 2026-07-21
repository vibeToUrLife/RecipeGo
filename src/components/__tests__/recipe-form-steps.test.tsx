import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { RecipeForm } from '@/components/recipe-form'
import type { RecipeWithChildren } from '@/lib/db-types'

// The form pulls in a server action and the Supabase-backed image uploader —
// neither matters for step reordering, so stub them out.
vi.mock('@/app/recipes/actions', () => ({ saveRecipe: vi.fn() }))
vi.mock('@/components/image-upload', () => ({ ImageUpload: () => null }))
vi.mock('@/components/i18n-provider', () => ({ useT: () => (k: string) => k }))

const recipe: RecipeWithChildren = {
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
  ingredients: [],
  steps: [
    { id: 's1', recipe_id: 'r1', step_number: 1, text: 'Step A', image_path: null },
    { id: 's2', recipe_id: 'r1', step_number: 2, text: 'Step B', image_path: null },
    { id: 's3', recipe_id: 'r1', step_number: 3, text: 'Step C', image_path: null },
  ],
}

const dataTransfer = { effectAllowed: '', dropEffect: '', setData: vi.fn() }

function stepTexts() {
  return screen.getAllByPlaceholderText('form.describeStep')
    .map((el) => (el as HTMLTextAreaElement).value)
}

describe('RecipeForm step drag-and-drop', () => {
  it('arms a row for dragging only while its grip is pressed', () => {
    render(<RecipeForm recipe={recipe} rooms={[]} />)
    const handles = screen.getAllByLabelText('form.dragToReorder')
    const row = handles[0].closest('[draggable]')!
    expect(row).toHaveAttribute('draggable', 'false')
    fireEvent.pointerDown(handles[0])
    expect(row).toHaveAttribute('draggable', 'true')
    fireEvent.pointerUp(handles[0])
    expect(row).toHaveAttribute('draggable', 'false')
  })

  it('reorders steps (and renumbers) when a row is dragged over another', () => {
    render(<RecipeForm recipe={recipe} rooms={[]} />)
    const handles = screen.getAllByLabelText('form.dragToReorder')
    const rows = handles.map((h) => h.closest('[draggable]')!)

    // Drag "Step A" down over "Step C" → live reorder to B, C, A.
    fireEvent.pointerDown(handles[0])
    fireEvent.dragStart(rows[0], { dataTransfer })
    fireEvent.dragEnter(rows[2], { dataTransfer })
    expect(stepTexts()).toEqual(['Step B', 'Step C', 'Step A'])

    // Numbers follow position, so a save renumbers 1..n in the new order.
    const numbers = screen.getAllByText(/^\d\.$/).map((el) => el.textContent)
    expect(numbers).toEqual(['1.', '2.', '3.'])

    // Drop cleanup disarms the row again.
    fireEvent.dragEnd(rows[0], { dataTransfer })
    expect(rows[0]).toHaveAttribute('draggable', 'false')
  })

  it('moves a step with the mobile up/down arrows and disables them at the edges', () => {
    render(<RecipeForm recipe={recipe} rooms={[]} />)
    const ups = screen.getAllByLabelText('form.moveStepUp')
    const downs = screen.getAllByLabelText('form.moveStepDown')

    // Edge rows can't move past the ends.
    expect(ups[0]).toBeDisabled()
    expect(downs[2]).toBeDisabled()
    expect(ups[1]).toBeEnabled()

    // "Step A" down one → B, A, C; then "Step C" up one → B, C, A.
    fireEvent.click(downs[0])
    expect(stepTexts()).toEqual(['Step B', 'Step A', 'Step C'])
    fireEvent.click(screen.getAllByLabelText('form.moveStepUp')[2])
    expect(stepTexts()).toEqual(['Step B', 'Step C', 'Step A'])
  })

  it('does not reorder when no step drag is in flight (e.g. dragging a file over the form)', () => {
    render(<RecipeForm recipe={recipe} rooms={[]} />)
    const handles = screen.getAllByLabelText('form.dragToReorder')
    const rows = handles.map((h) => h.closest('[draggable]')!)
    fireEvent.dragEnter(rows[2], { dataTransfer })
    expect(stepTexts()).toEqual(['Step A', 'Step B', 'Step C'])
  })
})
