import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CookMode } from '@/components/cook-mode'
import type { RecipeWithChildren } from '@/lib/db-types'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
// Keep translations out of the assertions, but keep the {n}/{total} vars — the
// step counter is the one string whose interpolation matters here.
vi.mock('@/components/i18n-provider', () => ({
  useT: () => (k: string, vars?: Record<string, string | number>) =>
    vars ? `${k}:${Object.values(vars).join(',')}` : k,
}))

// jsdom has no Wake Lock API; the hook feature-detects and stays inert.

const recipe: RecipeWithChildren = {
  id: 'r1',
  user_id: 'u1',
  title: 'Roast Chicken',
  description: null,
  image_path: null,
  servings: 2,
  prep_minutes: 10,
  cook_minutes: 50,
  difficulty: 'easy',
  source_url: null,
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
  room_id: null,
  ingredients: [
    { id: 'i1', recipe_id: 'r1', name: 'chicken', quantity: 1, unit: 'piece', category: 'Meat & Seafood', position: 0 },
    { id: 'i2', recipe_id: 'r1', name: 'salt', quantity: 1, unit: 'tsp', category: 'Pantry', position: 1 },
  ],
  steps: [
    { id: 's1', recipe_id: 'r1', step_number: 1, text: 'Heat the oven', image_path: null },
    { id: 's2', recipe_id: 'r1', step_number: 2, text: 'Season the bird', image_path: null },
    { id: 's3', recipe_id: 'r1', step_number: 3, text: 'Roast until done', image_path: null },
  ],
}

describe('CookMode', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows one step at a time, starting at the first', () => {
    render(<CookMode recipe={recipe} servings={2} />)
    expect(screen.getByText('Heat the oven')).toBeInTheDocument()
    expect(screen.queryByText('Season the bird')).toBeNull()
    expect(screen.getByText(/cookMode\.stepOf:1,3/)).toBeInTheDocument()
  })

  it('walks forward and back through the steps', () => {
    render(<CookMode recipe={recipe} servings={2} />)
    fireEvent.click(screen.getByRole('button', { name: /cookMode\.next/ }))
    expect(screen.getByText('Season the bird')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /cookMode\.prev/ }))
    expect(screen.getByText('Heat the oven')).toBeInTheDocument()
  })

  it('cannot go back past the first step', () => {
    render(<CookMode recipe={recipe} servings={2} />)
    expect(screen.getByRole('button', { name: /cookMode\.prev/ })).toBeDisabled()
  })

  it('offers to finish on the last step, and finishing returns to the recipe', () => {
    render(<CookMode recipe={recipe} servings={2} />)
    fireEvent.click(screen.getByRole('button', { name: /cookMode\.next/ }))
    fireEvent.click(screen.getByRole('button', { name: /cookMode\.next/ }))
    expect(screen.getByText('Roast until done')).toBeInTheDocument()

    const finish = screen.getByRole('button', { name: /cookMode\.finish/ })
    fireEvent.click(finish)
    expect(push).toHaveBeenCalledWith('/recipes/r1')
  })

  it('moves between steps with the arrow keys', () => {
    render(<CookMode recipe={recipe} servings={2} />)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText('Season the bird')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByText('Heat the oven')).toBeInTheDocument()
  })

  it('leaves cook mode on Escape', () => {
    render(<CookMode recipe={recipe} servings={2} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(push).toHaveBeenCalledWith('/recipes/r1')
  })

  it('scales the ingredients to the servings it was opened with, as fractions', () => {
    render(<CookMode recipe={recipe} servings={3} />)
    // 1 tsp salt for 2 servings → 1½ tsp for 3.
    expect(screen.getAllByText(/1½/).length).toBeGreaterThan(0)
  })

  it('ticks an ingredient off without touching the others', () => {
    render(<CookMode recipe={recipe} servings={2} />)
    const boxes = screen.getAllByRole('checkbox')
    expect(boxes[0]).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(boxes[0])
    expect(boxes[0]).toHaveAttribute('aria-checked', 'true')
    expect(boxes[1]).toHaveAttribute('aria-checked', 'false')
  })

  it('falls back to a way out when the recipe has no steps', () => {
    render(<CookMode recipe={{ ...recipe, steps: [] }} servings={2} />)
    expect(screen.getByText('cookMode.noSteps')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'cookMode.exit' }))
    expect(push).toHaveBeenCalledWith('/recipes/r1')
  })
})
