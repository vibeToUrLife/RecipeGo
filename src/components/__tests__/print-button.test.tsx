import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { PrintButton } from '@/components/print-button'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('PrintButton', () => {
  it('hands off to the browser print dialog, which is where the PDF comes from', async () => {
    const print = vi.fn()
    vi.stubGlobal('print', print)

    render(<PrintButton label="Print recipe (PDF)" />)
    await userEvent.click(screen.getByRole('button', { name: /print recipe/i }))

    expect(print).toHaveBeenCalledTimes(1)
  })

  it('keeps itself off the sheet it produces', () => {
    render(<PrintButton label="Print plan (PDF)" />)
    expect(screen.getByRole('button')).toHaveClass('print:hidden')
  })
})
