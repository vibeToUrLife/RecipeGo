import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/components/i18n-provider', () => ({ useT: () => (k: string) => k }))
const recover = vi.hoisted(() => ({ can: true, reload: vi.fn(() => true) }))
vi.mock('@/lib/recover', () => ({ canReloadToRecover: () => recover.can, reloadToRecover: recover.reload }))

import ErrorBoundary from '@/app/error'
import GlobalError from '@/app/global-error'

const boom = Object.assign(new Error('Loading chunk 42 failed'), { digest: 'abc123' })

beforeEach(() => {
  recover.can = true
  recover.reload.mockClear()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('the error page', () => {
  it('reloads by itself, over the welcome animation’s colour, rather than asking for a retry', () => {
    const { container } = render(<ErrorBoundary error={boom} unstable_retry={vi.fn()} />)
    expect(recover.reload).toHaveBeenCalledTimes(1)
    expect(container.querySelector('.splash-cover')).toBeInTheDocument()
    expect(screen.queryByText('error.retry')).toBeNull()
  })

  it('shows the error, with Retry, only once reloading has been tried enough', () => {
    recover.can = false
    render(<ErrorBoundary error={boom} unstable_retry={vi.fn()} />)
    expect(recover.reload).not.toHaveBeenCalled()
    expect(screen.getByText('error.title')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'error.retry' })).toBeInTheDocument()
    expect(screen.getByText('error.ref')).toBeInTheDocument()
  })
})

describe('the page for a failure in the layout itself', () => {
  it('reloads by itself too', () => {
    render(<GlobalError error={boom} />, { container: document.documentElement })
    expect(recover.reload).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('says so in both languages once reloading has been tried enough', () => {
    recover.can = false
    render(<GlobalError error={boom} />, { container: document.documentElement })
    expect(screen.getByRole('heading')).toHaveTextContent('出了点问题 · Something went wrong')
    expect(screen.getByRole('button', { name: '重新载入 · Reload' })).toBeInTheDocument()
  })
})
