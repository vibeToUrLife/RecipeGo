import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PlannedMeal } from '@/components/planned-meal'
import type { MealPlanEntryView } from '@/lib/db-types'

// The chip pulls in a router, plan server actions, and the recipe-view modal —
// none needed to test which control opens what, so stub them out. The view modal
// is replaced by a sentinel we can assert on without fetching a recipe.
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/components/i18n-provider', () => ({ useT: () => (k: string) => k }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/app/plan/actions', () => ({
  updatePlanServingsAction: vi.fn(),
  movePlanEntryAction: vi.fn(),
  removePlanEntryAction: vi.fn(),
}))
vi.mock('@/components/recipe-view-dialog', () => ({
  RecipeViewDialog: ({ recipeId }: { recipeId: string }) => (
    <div data-testid="recipe-view">viewing {recipeId}</div>
  ),
}))

const entry: MealPlanEntryView = {
  id: 'e1',
  user_id: 'u1',
  room_id: null,
  recipe_id: 'r1',
  plan_date: '2026-07-20',
  meal_slot: 'dinner',
  servings: 3,
  created_at: '2026-07-18T00:00:00Z',
  recipe_title: 'Roast Chicken',
}

describe('PlannedMeal', () => {
  it('opens the read-only recipe view (no navigation) when the meal is clicked', () => {
    render(<PlannedMeal entry={entry} />)
    // The view modal is not mounted until the meal title is clicked.
    expect(screen.queryByTestId('recipe-view')).toBeNull()
    fireEvent.click(screen.getByLabelText('plan.viewRecipe'))
    expect(screen.getByTestId('recipe-view')).toHaveTextContent('viewing r1')
  })

  it('opens the edit dialog (servings / move / remove) from the pencil, not the recipe view', () => {
    render(<PlannedMeal entry={entry} />)
    fireEvent.click(screen.getByLabelText('plan.editMeal'))
    // Edit dialog is up…
    expect(screen.getByText('plan.remove')).toBeInTheDocument()
    expect(screen.getByText('plan.moveTo')).toBeInTheDocument()
    // …and it did not open the recipe view.
    expect(screen.queryByTestId('recipe-view')).toBeNull()
  })
})
