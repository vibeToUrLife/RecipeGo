import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RecipeViewDialog } from '@/components/recipe-view-dialog'
import { getPlannedRecipeAction } from '@/app/plan/actions'
import { addToListAction } from '@/app/shopping-list/actions'
import type { RecipeWithChildren } from '@/lib/db-types'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }))
vi.mock('@/components/i18n-provider', () => ({ useT: () => (k: string) => k }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/app/plan/actions', () => ({ getPlannedRecipeAction: vi.fn() }))
vi.mock('@/app/shopping-list/actions', () => ({ addToListAction: vi.fn() }))

const recipe = (roomId: string | null = null): RecipeWithChildren => ({
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
  room_id: roomId,
  ingredients: [
    { id: 'i1', recipe_id: 'r1', name: 'miso paste', quantity: 2, unit: 'tbsp', category: 'Pantry', position: 0 },
  ],
  steps: [{ id: 's1', recipe_id: 'r1', step_number: 1, text: 'Whisk the miso in.', image_path: null }],
})

const onClose = vi.fn()

beforeEach(() => {
  vi.mocked(getPlannedRecipeAction).mockResolvedValue(recipe())
  vi.mocked(addToListAction).mockResolvedValue(undefined)
  push.mockClear()
  onClose.mockClear()
  vi.mocked(addToListAction).mockClear()
})

function open(plannedServings = 4) {
  return render(
    <RecipeViewDialog recipeId="r1" title="Miso Soup" plannedServings={plannedServings} onClose={onClose} />,
  )
}

describe('RecipeViewDialog shopping-list button', () => {
  it('shops for this one planned meal at the servings it was planned for', async () => {
    open(4)
    await userEvent.click(await screen.findByRole('button', { name: 'detail.addToList' }))

    // The plan grid stores 4 servings for this meal; the recipe's own base is 2.
    await waitFor(() => expect(addToListAction).toHaveBeenCalledWith('r1', 4))
    // Dismisses itself rather than hanging over the list it navigates to.
    expect(onClose).toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith('/shopping-list')
  })

  it('follows the stepper when you shop for a different number of people', async () => {
    open(4)
    await screen.findByRole('button', { name: 'detail.addToList' })
    await userEvent.click(screen.getByRole('button', { name: '＋' }))
    await userEvent.click(screen.getByRole('button', { name: 'detail.addToList' }))

    await waitFor(() => expect(addToListAction).toHaveBeenCalledWith('r1', 5))
  })

  it("adds to the room's list when the planned recipe belongs to a room", async () => {
    vi.mocked(getPlannedRecipeAction).mockResolvedValue(recipe('room-1'))
    open(2)
    await userEvent.click(await screen.findByRole('button', { name: 'detail.addToList' }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/rooms/room-1/shopping-list'))
  })
})
