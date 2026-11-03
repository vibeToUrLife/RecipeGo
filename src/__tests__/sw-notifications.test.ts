import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

// public/sw.js, run against a stand-in for the service worker's world.
const source = readFileSync(join(process.cwd(), 'public/sw.js'), 'utf8')
const ORIGIN = 'https://recipego.test'

type Window = { url: string; focus: ReturnType<typeof vi.fn>; navigate: ReturnType<typeof vi.fn> }

function worker(windows: Window[] = []) {
  const handlers: Record<string, (event: unknown) => void> = {}
  const self = {
    addEventListener: (type: string, handler: (event: unknown) => void) => { handlers[type] = handler },
    skipWaiting: vi.fn(),
    location: { origin: ORIGIN },
    registration: { showNotification: vi.fn(async () => {}) },
    clients: { matchAll: vi.fn(async () => windows), openWindow: vi.fn(async () => null), claim: vi.fn() },
  }
  new Function('self', 'caches', source)(self, {})
  // Fires an event and waits for what it handed to waitUntil.
  const fire = async (type: string, event: object) => {
    const waits: Promise<unknown>[] = []
    handlers[type]({ ...event, waitUntil: (p: Promise<unknown>) => waits.push(p) })
    await Promise.all(waits)
  }
  return { self, fire }
}

const pushOf = (data: unknown) => ({ data: { json: () => (data instanceof Error ? (() => { throw data })() : data) } })
const tap = (url: string) => ({ notification: { data: { url }, close: vi.fn() } })
const openWindow = (url: string, navigate = vi.fn(async () => ({}))): Window => ({ url, focus: vi.fn(async () => {}), navigate })

describe('the service worker’s notifications', () => {
  it('shows what the server sent', async () => {
    const { self, fire } = worker()
    await fire('push', pushOf({ title: 'Southbay Kitchen · 购物清单', body: 'Alex 加了 鸡蛋', url: '/rooms/r1/shopping-list', tag: 'list:r1' }))
    expect(self.registration.showNotification).toHaveBeenCalledWith('Southbay Kitchen · 购物清单', {
      body: 'Alex 加了 鸡蛋',
      tag: 'list:r1',
      icon: '/icon-192.png',
      data: { url: '/rooms/r1/shopping-list' },
    })
  })

  it('still shows something for a push it can’t read (a phone may stop delivering to a site that shows nothing)', async () => {
    const { self, fire } = worker()
    await fire('push', pushOf(new SyntaxError('not JSON')))
    await fire('push', { data: null })
    expect(self.registration.showNotification).toHaveBeenCalledTimes(2)
    expect(self.registration.showNotification).toHaveBeenCalledWith('RecipeGo', expect.objectContaining({ data: { url: '/' } }))
  })

  it('opens the list or plan in the app when it’s tapped, if the app is open', async () => {
    const app = openWindow(`${ORIGIN}/plan`)
    const { self, fire } = worker([app])
    const event = tap('/rooms/r1/shopping-list')
    await fire('notificationclick', event)
    expect(event.notification.close).toHaveBeenCalled()
    expect(app.focus).toHaveBeenCalled()
    expect(app.navigate).toHaveBeenCalledWith(`${ORIGIN}/rooms/r1/shopping-list`)
    expect(self.clients.openWindow).not.toHaveBeenCalled()
  })

  it('opens it afresh when the app isn’t open, or its page can’t be sent there', async () => {
    const closed = worker()
    await closed.fire('notificationclick', tap('/rooms/r1/plan?week=2026-11-02'))
    expect(closed.self.clients.openWindow).toHaveBeenCalledWith(`${ORIGIN}/rooms/r1/plan?week=2026-11-02`)

    const stuck = worker([openWindow(`${ORIGIN}/`, vi.fn(async () => { throw new TypeError('not controlled') }))])
    await stuck.fire('notificationclick', tap('/rooms/r1/shopping-list'))
    expect(stuck.self.clients.openWindow).toHaveBeenCalledWith(`${ORIGIN}/rooms/r1/shopping-list`)
  })

  it('never opens a page on another site', async () => {
    const app = openWindow(`${ORIGIN}/`)
    const { self, fire } = worker([app])
    await fire('notificationclick', tap('https://evil.example/phish'))
    expect(app.navigate).not.toHaveBeenCalled()
    expect(self.clients.openWindow).not.toHaveBeenCalled()
  })
})
