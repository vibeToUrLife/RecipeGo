import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AddMealDialog } from '@/components/add-meal-dialog'
import type { Recipe } from '@/lib/db-types'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/components/i18n-provider', () => ({ useT: () => (k: string) => k }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/app/plan/actions', () => ({ addPlanEntryAction: vi.fn() }))
// Just which photo it would show.
vi.mock('next/image', () => ({ default: ({ src }: { src: string }) => <span data-testid="photo" data-src={src} /> }))

const recipe = (over: Partial<Recipe>): Recipe => ({
  id: 'r1', user_id: 'u1', title: 'Roast Chicken', description: null, image_path: null, servings: 4,
  prep_minutes: null, cook_minutes: null, difficulty: null, source_url: null,
  created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z', room_id: null,
  ...over,
})
const recipes = [
  recipe({ id: 'r1', title: 'Roast Chicken', image_path: 'u1/chicken.jpg' }),
  recipe({ id: 'r2', title: 'Lemon Soup', servings: 2 }),
]

function openPicker() {
  render(<AddMealDialog planDate="2026-11-02" slot="dinner" recipes={recipes} roomId={null} />)
  fireEvent.click(screen.getByRole('button', { name: 'plan.addMeal' }))
}
const row = (title: string) => screen.getByText(title).closest('button')!

describe('AddMealDialog', () => {
  beforeEach(() => vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://demo.supabase.co'))
  afterEach(() => vi.unstubAllEnvs())

  it('shows each recipe with its photo, or a plate when it has none', () => {
    openPicker()
    expect(within(row('Roast Chicken')).getByTestId('photo')).toHaveAttribute(
      'data-src', 'https://demo.supabase.co/storage/v1/object/public/recipe-images/u1/chicken.jpg')
    expect(within(row('Lemon Soup')).queryByTestId('photo')).toBeNull()
    expect(row('Lemon Soup')).toHaveTextContent('🍽️')
  })

  it('rises from the bottom of a phone screen, with a list of one height', () => {
    openPicker()
    expect(document.querySelector('[data-slot="dialog-content"]')).toHaveClass('max-sm:bottom-0')
    expect(row('Roast Chicken').parentElement).toHaveClass('max-sm:h-[65dvh]')
  })

  it('narrows the list as you search, and takes a pick on to its servings', () => {
    openPicker()
    fireEvent.change(screen.getByPlaceholderText('common.search'), { target: { value: 'soup' } })
    expect(screen.queryByText('Roast Chicken')).toBeNull()
    fireEvent.click(row('Lemon Soup'))
    expect(screen.getByText('plan.forPeople')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })
})
