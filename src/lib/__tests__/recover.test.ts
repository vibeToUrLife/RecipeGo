import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { canReloadToRecover, page, reloadToRecover } from '@/lib/recover'
import { WELCOMED_KEY } from '@/lib/welcome'

let reload: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  sessionStorage.clear()
  reload = vi.spyOn(page, 'reload').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('reloadToRecover', () => {
  it('reloads the page, with the welcome animation to play over it', () => {
    sessionStorage.setItem(WELCOMED_KEY, '1')
    expect(reloadToRecover()).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem(WELCOMED_KEY)).toBeNull()
  })

  it('stops after two tries in a minute, so a lasting failure shows instead of reloading for ever', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-04T10:00:00Z'))
    expect(reloadToRecover()).toBe(true)
    vi.setSystemTime(new Date('2026-11-04T10:00:20Z'))
    expect(reloadToRecover()).toBe(true)
    vi.setSystemTime(new Date('2026-11-04T10:00:40Z'))
    expect(canReloadToRecover()).toBe(false)
    expect(reloadToRecover()).toBe(false)
    expect(reload).toHaveBeenCalledTimes(2)

    // A minute after the first, it's a fresh start.
    vi.setSystemTime(new Date('2026-11-04T10:01:01Z'))
    expect(canReloadToRecover()).toBe(true)
    expect(reloadToRecover()).toBe(true)
  })

  it('never reloads where the tab can’t keep count of its tries', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    expect(canReloadToRecover()).toBe(false)
    expect(reloadToRecover()).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })
})
