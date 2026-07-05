import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { WeekPlanner } from '@/components/week-planner'

// WeekPlanner pulls in a router, toast, a server action, and three child
// components — none relevant to the week-nav label, so stub them out.
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('@/components/i18n-provider', () => ({
  useT: () => (k: string) => k,
  useLocale: () => 'en',
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/app/plan/actions', () => ({ addWeekToShoppingListAction: vi.fn() }))
vi.mock('@/components/add-meal-dialog', () => ({ AddMealDialog: () => null }))
vi.mock('@/components/planned-meal', () => ({ PlannedMeal: () => null }))
vi.mock('@/components/week-start-selector', () => ({ WeekStartSelector: () => null }))

const baseProps = { entries: [], recipes: [], roomId: null, weekStartsOn: 1 }

describe('WeekPlanner week-nav label', () => {
  it('shows the viewed week range and hides the jump button on the current week', () => {
    render(<WeekPlanner {...baseProps} weekStartISO="2026-06-29" todayWeekISO="2026-06-29" />)
    // Middle label reflects the week in view (Mon 29 Jun – Sun 5 Jul).
    expect(screen.getByText(/29 Jun.*5 Jul/)).toBeInTheDocument()
    // Already on the current week → no "this week" jump button.
    expect(screen.queryByText('plan.thisWeek')).toBeNull()
    // Arrows point one week back / forward.
    expect(document.querySelector('a[href="/plan?week=2026-06-22"]')).not.toBeNull()
    expect(document.querySelector('a[href="/plan?week=2026-07-06"]')).not.toBeNull()
  })

  it('shows the next-week range and a jump-back button when viewing next week', () => {
    render(<WeekPlanner {...baseProps} weekStartISO="2026-07-06" todayWeekISO="2026-06-29" />)
    // Label now shows next week's dates, proving it changes as you navigate.
    expect(screen.getByText(/6 Jul.*12 Jul/)).toBeInTheDocument()
    // Off the current week → jump-back button appears, linking to today's week.
    expect(screen.getByText('plan.thisWeek').closest('a')).toHaveAttribute('href', '/plan?week=2026-06-29')
  })
})
