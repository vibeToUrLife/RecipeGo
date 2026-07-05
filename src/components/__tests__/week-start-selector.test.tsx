import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const action = vi.hoisted(() => ({ fn: vi.fn(async (_n: number) => ({ ok: true as const })) }))
const refresh = vi.fn()
vi.mock('@/app/plan/actions', () => ({ setWeekStartAction: (n: number) => action.fn(n) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('@/components/i18n-provider', () => ({ useT: () => (k: string) => k }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
import { WeekStartSelector } from '@/components/week-start-selector'

beforeEach(() => {
  action.fn.mockClear()
  action.fn.mockResolvedValue({ ok: true })
  refresh.mockClear()
})

describe('WeekStartSelector', () => {
  it('shows the current value and 7 options', () => {
    render(<WeekStartSelector value={1} />)
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('1')
    expect(select.querySelectorAll('option').length).toBe(7)
  })
  it('saves the chosen day and refreshes', async () => {
    render(<WeekStartSelector value={1} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '0' } })
    await waitFor(() => expect(action.fn).toHaveBeenCalledWith(0))
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
  })
})
