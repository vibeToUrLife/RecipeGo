import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const recover = vi.hoisted(() => ({ reload: vi.fn(() => true) }))
vi.mock('@/lib/recover', () => ({ reloadToRecover: recover.reload }))

import { ReloadWhenStale } from '@/components/reload-when-stale'

let original: typeof fetch
beforeEach(() => {
  recover.reload.mockClear()
  recover.reload.mockReturnValue(true)
  original = vi.fn(async (_input: RequestInfo | URL) => new Response('ok')) as unknown as typeof fetch
  window.fetch = original
})
afterEach(() => {
  window.fetch = original
})

const reply = (headers: Record<string, string>) => vi.mocked(original).mockResolvedValueOnce(new Response('', { status: 404, headers }))

describe('ReloadWhenStale', () => {
  it('reloads into the new version when the server no longer knows a server action', async () => {
    render(<ReloadWhenStale />)
    reply({ 'x-nextjs-action-not-found': '1' })
    let settled = false
    window.fetch('/rooms/r1/shopping-list', { method: 'POST' }).then(() => { settled = true })
    await vi.waitFor(() => expect(recover.reload).toHaveBeenCalledTimes(1))
    await new Promise((r) => setTimeout(r, 20))
    // Left hanging: no "please try again" for an action the reload replaces.
    expect(settled).toBe(false)
  })

  it('passes every other reply through untouched', async () => {
    render(<ReloadWhenStale />)
    const res = await window.fetch('/api/anything')
    expect(await res.text()).toBe('ok')
    expect(recover.reload).not.toHaveBeenCalled()
  })

  it('lets the failure through as usual once it has stopped reloading', async () => {
    recover.reload.mockReturnValue(false)
    render(<ReloadWhenStale />)
    reply({ 'x-nextjs-action-not-found': '1' })
    const res = await window.fetch('/plan', { method: 'POST' })
    expect(res.headers.get('x-nextjs-action-not-found')).toBe('1')
  })

  it('puts fetch back as it was when it goes', () => {
    const { unmount } = render(<ReloadWhenStale />)
    expect(window.fetch).not.toBe(original)
    unmount()
    expect(window.fetch).toBe(original)
  })
})
