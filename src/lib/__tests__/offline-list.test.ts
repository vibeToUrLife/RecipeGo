import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  forgetOfflineLists,
  forgetTick,
  keepForOffline,
  rememberTick,
  sendUnsentTicks,
  unsentTicks,
  useOnline,
  useUnsentTicks,
} from '@/lib/offline-list'

const KEY = 'recipego:unsent-ticks'

beforeEach(() => {
  for (const id of Object.keys(unsentTicks())) forgetTick(id)
})

describe('ticks kept on the phone', () => {
  it('are saved in local storage until they are sent', () => {
    rememberTick('a', true)
    rememberTick('b', false)
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ a: true, b: false })

    forgetTick('a')
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ b: false })
    forgetTick('b')
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('keep only the latest tick of an item', () => {
    rememberTick('a', true)
    rememberTick('a', false)
    expect(unsentTicks()).toEqual({ a: false })
  })

  it('are picked up from another tab of the app', () => {
    const { result } = renderHook(() => useUnsentTicks())
    expect(result.current).toEqual({})

    localStorage.setItem(KEY, JSON.stringify({ a: true }))
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: KEY })) })
    expect(result.current).toEqual({ a: true })
  })
})

describe('sendUnsentTicks', () => {
  it('sends each tick in turn and forgets it once it has gone', async () => {
    rememberTick('a', true)
    rememberTick('b', false)
    const send = vi.fn().mockResolvedValue(undefined)

    await sendUnsentTicks(send)

    expect(send.mock.calls).toEqual([['a', true], ['b', false]])
    expect(unsentTicks()).toEqual({})
  })

  it('stops at the first that fails and keeps the rest for the next try', async () => {
    rememberTick('a', true)
    rememberTick('b', true)
    const send = vi.fn().mockRejectedValue(new TypeError('Load failed'))

    await sendUnsentTicks(send)

    expect(send).toHaveBeenCalledTimes(1)
    expect(unsentTicks()).toEqual({ a: true, b: true })
  })

  it('sends a tick again if it changed while it was being sent', async () => {
    rememberTick('a', true)
    const send = vi.fn(async (id: string, checked: boolean) => {
      if (checked) rememberTick(id, false) // unticked again mid-send
    })

    await sendUnsentTicks(send)

    expect(send.mock.calls).toEqual([['a', true], ['a', false]])
    expect(unsentTicks()).toEqual({})
  })

  it('joins a send already under way rather than sending twice', async () => {
    rememberTick('a', true)
    let finish!: () => void
    const send = vi.fn(() => new Promise<void>((res) => { finish = res }))

    const first = sendUnsentTicks(send)
    const second = sendUnsentTicks(send)
    await vi.waitFor(() => expect(send).toHaveBeenCalled())
    finish()
    await Promise.all([first, second])

    expect(send).toHaveBeenCalledTimes(1)
    expect(unsentTicks()).toEqual({})
  })
})

describe('useOnline', () => {
  afterEach(() => {
    delete (navigator as unknown as Record<string, unknown>).onLine
  })

  it('follows the phone going offline and back', () => {
    let online = true
    Object.defineProperty(navigator, 'onLine', { get: () => online, configurable: true })
    const { result } = renderHook(() => useOnline())
    expect(result.current).toBe(true)

    online = false
    act(() => { window.dispatchEvent(new Event('offline')) })
    expect(result.current).toBe(false)

    online = true
    act(() => { window.dispatchEvent(new Event('online')) })
    expect(result.current).toBe(true)
  })
})

describe('messages to the service worker', () => {
  afterEach(() => {
    delete (navigator as unknown as Record<string, unknown>).serviceWorker
  })

  it('ask it to keep a list, or to forget the kept lists, once it is running', async () => {
    const postMessage = vi.fn()
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve({ active: { postMessage } }) },
      configurable: true,
    })

    keepForOffline('/rooms/r1/shopping-list')
    forgetOfflineLists()
    await vi.waitFor(() => expect(postMessage).toHaveBeenCalledTimes(2))

    expect(postMessage).toHaveBeenNthCalledWith(1, { type: 'keep', path: '/rooms/r1/shopping-list' })
    expect(postMessage).toHaveBeenNthCalledWith(2, { type: 'forget' })
  })

  it('do nothing where there is no service worker', () => {
    expect('serviceWorker' in navigator).toBe(false)
    expect(() => {
      keepForOffline('/shopping-list')
      forgetOfflineLists()
    }).not.toThrow()
  })
})
