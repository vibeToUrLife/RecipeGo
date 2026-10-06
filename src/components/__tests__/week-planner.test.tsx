import { render, screen, within, fireEvent, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { WeekPlanner } from '@/components/week-planner'
import { movePlanEntryAction, setPlanEntryEatenAction } from '@/app/plan/actions'
import { PLAN_ENTRY_DRAG_TYPE } from '@/lib/plan/drag'
import { toast } from 'sonner'
import type { MealPlanEntryView } from '@/lib/db-types'

// WeekPlanner pulls in a router, toast, a server action, and three child
// components — none relevant to the week-nav label, so stub them out.
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('@/components/i18n-provider', () => ({
  useT: () => (k: string) => k,
  useLocale: () => 'en',
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/app/plan/actions', () => ({
  addWeekToShoppingListAction: vi.fn(),
  movePlanEntryAction: vi.fn(),
  setPlanEntryEatenAction: vi.fn(),
}))
vi.mock('@/components/add-meal-dialog', () => ({ AddMealDialog: () => null }))
// Just the title, to show which meal sits in which slot, and its ✓ (named by a
// label, not text, so it isn't counted as a meal).
vi.mock('@/components/planned-meal', () => ({
  PlannedMeal: ({ entry, onEaten }: { entry: MealPlanEntryView; onEaten: () => void }) => (
    <span>
      {entry.recipe_title}
      <button type="button" aria-label={`ate ${entry.recipe_title}`} onClick={onEaten} />
    </span>
  ),
}))
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

describe('WeekPlanner print/PDF', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('prints the week on demand', async () => {
    const print = vi.fn()
    vi.stubGlobal('print', print)

    render(<WeekPlanner {...baseProps} weekStartISO="2026-06-29" todayWeekISO="2026-06-29" />)
    await userEvent.click(screen.getByRole('button', { name: 'print.plan' }))

    expect(print).toHaveBeenCalledTimes(1)
  })

  it('leaves the week range on the sheet while the controls around it opt out', () => {
    render(<WeekPlanner {...baseProps} weekStartISO="2026-06-29" todayWeekISO="2026-06-29" />)
    // The range is the printout's only clue about which week it covers, so it
    // must not inherit print:hidden from an ancestor.
    const range = screen.getByText(/29 Jun.*5 Jul/)
    expect(range.closest('.print\\:hidden')).toBeNull()
    // The arrows either side of it are screen-only.
    expect(document.querySelector('a[href="/plan?week=2026-06-22"]')).toHaveClass('print:hidden')
  })
})

// A week with meals in it, for the tests that move them about or eat them.
const meal = (over: Partial<MealPlanEntryView>): MealPlanEntryView => ({
  id: 'e1',
  user_id: 'u1',
  room_id: null,
  recipe_id: 'r1',
  plan_date: '2026-06-29',
  meal_slot: 'dinner',
  servings: 2,
  note: null,
  eaten_at: null,
  created_at: '2026-06-26T10:00:00Z',
  recipe_title: 'Roast Chicken',
  ...over,
})
// In the server's order (by day): Monday's chicken first, though the soup
// already on Wednesday was added before it.
const chicken = meal({})
const soup = meal({ id: 'e2', recipe_title: 'Soup', plan_date: '2026-07-01', meal_slot: 'lunch', created_at: '2026-06-25T10:00:00Z' })
const week = { ...baseProps, weekStartISO: '2026-06-29', todayWeekISO: '2026-06-29' }

// One meal slot of one day, found by the labels on screen.
const slot = (day: string, name: string) =>
  within(screen.getByText(day).parentElement!).getByText(name).parentElement!
const mealsIn = (el: HTMLElement) =>
  within(el).queryAllByText(/Roast Chicken|Soup/).map((n) => n.textContent)

describe('WeekPlanner drag and drop', () => {
  // A drag in progress, as the browser shows it to each slot it passes over.
  const drag = (data: Record<string, string>) => ({
    types: Object.keys(data),
    getData: (type: string) => data[type] ?? '',
    dropEffect: 'none',
  })
  const mealDrag = (id: string) => drag({ [PLAN_ENTRY_DRAG_TYPE]: id })

  beforeEach(() => {
    vi.mocked(movePlanEntryAction).mockReset()
    vi.mocked(movePlanEntryAction).mockResolvedValue({ ok: true })
    vi.mocked(toast.error).mockClear()
  })

  it('moves a meal dropped on another slot there at once, and saves it', async () => {
    let release!: () => void
    vi.mocked(movePlanEntryAction).mockImplementation(
      () => new Promise((res) => { release = () => res({ ok: true }) }),
    )
    const { rerender } = render(<WeekPlanner {...week} entries={[chicken, soup]} />)
    const wedLunch = slot('Wed 1 Jul', 'plan.lunch')

    // Taking the drag is what lets the browser drop it here; the slot lights up.
    expect(fireEvent.dragOver(wedLunch, { dataTransfer: mealDrag('e1') })).toBe(false)
    expect(wedLunch).toHaveClass('ring-2')
    fireEvent.drop(wedLunch, { dataTransfer: mealDrag('e1') })

    expect(movePlanEntryAction).toHaveBeenCalledWith('e1', '2026-07-01', 'lunch')
    expect(wedLunch).not.toHaveClass('ring-2')
    // There before the server answers, after the soup that was added first…
    expect(mealsIn(wedLunch)).toEqual(['Soup', 'Roast Chicken'])
    expect(mealsIn(slot('Mon 29 Jun', 'plan.dinner'))).toEqual([])

    await act(async () => { release() })
    // …and the server's copy, sorted by day alone, leaves it where it landed.
    rerender(<WeekPlanner {...week} entries={[{ ...chicken, plan_date: '2026-07-01', meal_slot: 'lunch' }, soup]} />)
    expect(mealsIn(slot('Wed 1 Jul', 'plan.lunch'))).toEqual(['Soup', 'Roast Chicken'])
  })

  it('leaves a meal dropped back on its own slot alone', () => {
    render(<WeekPlanner {...week} entries={[chicken, soup]} />)
    fireEvent.drop(slot('Mon 29 Jun', 'plan.dinner'), { dataTransfer: mealDrag('e1') })
    expect(movePlanEntryAction).not.toHaveBeenCalled()
  })

  it('puts the meal back and says why when the move fails', async () => {
    vi.mocked(movePlanEntryAction).mockResolvedValue({ error: 'Could not update your plan. Please try again.' })
    render(<WeekPlanner {...week} entries={[chicken, soup]} />)
    fireEvent.drop(slot('Wed 1 Jul', 'plan.lunch'), { dataTransfer: mealDrag('e1') })

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not update your plan. Please try again.'))
    await waitFor(() => expect(mealsIn(slot('Mon 29 Jun', 'plan.dinner'))).toEqual(['Roast Chicken']))
    expect(mealsIn(slot('Wed 1 Jul', 'plan.lunch'))).toEqual(['Soup'])
  })

  it('ignores dragged text, links and files', () => {
    render(<WeekPlanner {...week} entries={[chicken, soup]} />)
    const wedLunch = slot('Wed 1 Jul', 'plan.lunch')
    const text = drag({ 'text/plain': 'e1' })

    // Not taken, so the browser won't drop it here.
    expect(fireEvent.dragOver(wedLunch, { dataTransfer: text })).toBe(true)
    expect(wedLunch).not.toHaveClass('ring-2')
    fireEvent.drop(wedLunch, { dataTransfer: text })
    expect(movePlanEntryAction).not.toHaveBeenCalled()
  })

  it("ignores a meal that isn't on this week's grid", () => {
    render(<WeekPlanner {...week} entries={[chicken, soup]} />)
    fireEvent.drop(slot('Wed 1 Jul', 'plan.lunch'), { dataTransfer: mealDrag('from-another-tab') })
    expect(movePlanEntryAction).not.toHaveBeenCalled()
  })

  it('stops lighting up a slot once the drag has left it', () => {
    render(<WeekPlanner {...week} entries={[chicken, soup]} />)
    const wedLunch = slot('Wed 1 Jul', 'plan.lunch')
    const leave = (to: Element) => {
      const e = new Event('dragleave', { bubbles: true })
      Object.defineProperty(e, 'relatedTarget', { value: to })
      fireEvent(wedLunch, e)
    }
    fireEvent.dragOver(wedLunch, { dataTransfer: mealDrag('e1') })

    leave(within(wedLunch).getByText('Soup')) // onto a meal inside it: still over it
    expect(wedLunch).toHaveClass('ring-2')
    leave(document.body)
    expect(wedLunch).not.toHaveClass('ring-2')
  })
})

describe('WeekPlanner eaten meals', () => {
  const mondayDinner = () => mealsIn(slot('Mon 29 Jun', 'plan.dinner'))
  // The Undo on the "marked as eaten" toast.
  const undo = () =>
    (vi.mocked(toast.success).mock.calls[0][1] as { action: { label: string; onClick: () => void } }).action

  beforeEach(() => {
    vi.mocked(setPlanEntryEatenAction).mockReset()
    vi.mocked(setPlanEntryEatenAction).mockResolvedValue({ ok: true })
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
  })

  it('takes a meal off the plan as soon as it is marked eaten, and saves that', async () => {
    let release!: () => void
    vi.mocked(setPlanEntryEatenAction).mockImplementation(
      () => new Promise((res) => { release = () => res({ ok: true }) }),
    )
    const { rerender } = render(<WeekPlanner {...week} entries={[chicken, soup]} />)
    fireEvent.click(screen.getByRole('button', { name: 'ate Roast Chicken' }))

    expect(setPlanEntryEatenAction).toHaveBeenCalledWith('e1', true)
    // Gone before the server answers, and the rest of the week left alone…
    expect(mondayDinner()).toEqual([])
    expect(mealsIn(slot('Wed 1 Jul', 'plan.lunch'))).toEqual(['Soup'])

    await act(async () => { release() })
    // …and the server's copy, which leaves eaten meals out, keeps it gone.
    rerender(<WeekPlanner {...week} entries={[soup]} />)
    expect(mondayDinner()).toEqual([])
    expect(toast.success).toHaveBeenCalledWith('plan.markedEaten', expect.anything())
    expect(undo().label).toBe('common.undo')
  })

  it('puts the meal back and says why when marking it eaten fails', async () => {
    vi.mocked(setPlanEntryEatenAction).mockResolvedValue({ error: 'Could not update your plan. Please try again.' })
    render(<WeekPlanner {...week} entries={[chicken, soup]} />)
    fireEvent.click(screen.getByRole('button', { name: 'ate Roast Chicken' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not update your plan. Please try again.'))
    await waitFor(() => expect(mondayDinner()).toEqual(['Roast Chicken']))
    // No Undo offered for something that didn't happen.
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('puts an eaten meal back on Undo, and saves that', async () => {
    const { rerender } = render(<WeekPlanner {...week} entries={[chicken, soup]} />)
    fireEvent.click(screen.getByRole('button', { name: 'ate Roast Chicken' }))
    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    rerender(<WeekPlanner {...week} entries={[soup]} />)
    expect(mondayDinner()).toEqual([])

    let release!: () => void
    vi.mocked(setPlanEntryEatenAction).mockImplementation(
      () => new Promise((res) => { release = () => res({ ok: true }) }),
    )
    act(() => undo().onClick())

    expect(setPlanEntryEatenAction).toHaveBeenLastCalledWith('e1', false)
    // Back before the server answers…
    expect(mondayDinner()).toEqual(['Roast Chicken'])
    await act(async () => { release() })
    // …and still there in the server's copy after.
    rerender(<WeekPlanner {...week} entries={[chicken, soup]} />)
    expect(mondayDinner()).toEqual(['Roast Chicken'])
  })
})
