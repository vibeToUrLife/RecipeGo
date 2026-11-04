import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

// public/sw.js opening pages, run against a stand-in for the service worker's
// world: what it answers a navigation with, and what it asks the network for.
const source = readFileSync(join(process.cwd(), 'public/sw.js'), 'utf8')
const ORIGIN = 'https://recipego.test'
const html = (body: string) => new Response(body, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })

type Req = string | { url: string }
const href = (r: Req) => new URL(typeof r === 'string' ? r : r.url, ORIGIN).href

// Just enough of the Cache API for the worker's own use of it.
function cacheStorage() {
  const stores = new Map<string, Map<string, Response>>()
  const open = async (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map())
    const entries = stores.get(name)!
    return {
      put: async (r: Req, response: Response) => { entries.set(href(r), response) },
      match: async (r: Req) => entries.get(href(r))?.clone(),
      keys: async () => [...entries.keys()].map((url) => ({ url })),
      delete: async (r: Req) => entries.delete(href(r)),
    }
  }
  return {
    stores,
    open,
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    match: async (r: Req, { cacheName }: { cacheName: string }) => (stores.has(cacheName) ? (await open(cacheName)).match(r) : undefined),
  }
}

function worker({ fetch = vi.fn(async (r: Req): Promise<Response> => html(`fetched ${href(r)}`)), preload = { enable: vi.fn(async () => {}) } as unknown } = {}) {
  const handlers: Record<string, (event: unknown) => void> = {}
  const self = {
    addEventListener: (type: string, handler: (event: unknown) => void) => { handlers[type] = handler },
    skipWaiting: vi.fn(),
    location: { origin: ORIGIN },
    registration: { navigationPreload: preload },
    clients: { claim: vi.fn(async () => {}) },
  }
  const caches = cacheStorage()
  new Function('self', 'caches', 'fetch', source)(self, caches, fetch)

  const activate = async () => {
    const waits: Promise<unknown>[] = []
    handlers.activate({ waitUntil: (p: Promise<unknown>) => waits.push(p) })
    await Promise.all(waits)
  }
  // Opens a page: what the worker answers with, once it has finished with it.
  const open = async (path: string, preloadResponse?: Promise<Response | undefined>) => {
    let answer: Promise<Response> | undefined
    const waits: Promise<unknown>[] = []
    handlers.fetch({
      request: { method: 'GET', mode: 'navigate', url: ORIGIN + path },
      preloadResponse,
      respondWith: (p: Promise<Response>) => { answer = p },
      waitUntil: (p: Promise<unknown>) => waits.push(p),
    })
    const response = await answer!
    await Promise.all(waits)
    return response
  }
  return { self, fetch, caches, activate, open }
}

describe('the service worker opening pages', () => {
  it('has the browser fetch a page while it starts up, from when it takes over', async () => {
    const { self, activate } = worker()
    await activate()
    expect(self.registration.navigationPreload).toMatchObject({ enable: expect.any(Function) })
    expect((self.registration.navigationPreload as { enable: ReturnType<typeof vi.fn> }).enable).toHaveBeenCalled()
    expect(self.clients.claim).toHaveBeenCalled()
  })

  it('still takes over where the browser can’t do that', async () => {
    const refused = worker({ preload: { enable: vi.fn(async () => { throw new DOMException('no', 'InvalidStateError') }) } })
    await refused.activate()
    expect(refused.self.clients.claim).toHaveBeenCalled()

    const older = worker({ preload: undefined })
    await older.activate()
    expect(older.self.clients.claim).toHaveBeenCalled()
  })

  it('opens a page with what the browser fetched ahead, asking the server nothing more', async () => {
    const { fetch, open } = worker()
    const page = await open('/rooms/r1', Promise.resolve(html('Southbay Kitchen')))
    expect(await page.text()).toBe('Southbay Kitchen')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('fetches the page itself when nothing was fetched ahead (turned off, or not supported)', async () => {
    const off = worker()
    expect(await (await off.open('/rooms/r1', Promise.resolve(undefined))).text()).toBe(`fetched ${ORIGIN}/rooms/r1`)
    expect(off.fetch).toHaveBeenCalledTimes(1)

    const unsupported = worker()
    expect(await (await unsupported.open('/plan')).text()).toBe(`fetched ${ORIGIN}/plan`)
    expect(unsupported.fetch).toHaveBeenCalledTimes(1)
  })

  it('shows the offline page when the page can’t come, fetched ahead or not', async () => {
    const { fetch, open } = worker({ fetch: vi.fn(async () => { throw new TypeError('Failed to fetch') }) })
    expect(await (await open('/rooms/r1', Promise.reject(new TypeError('Failed to fetch')))).text()).toContain('没有网络 · Offline')
    expect(await (await open('/plan')).text()).toContain('没有网络 · Offline')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('keeps a shopping list fetched ahead, with its files, and opens that copy when there’s no signal', async () => {
    const files: Record<string, string> = { [`${ORIGIN}/_next/static/chunks/list.js`]: 'list()' }
    const { fetch, caches, open } = worker({
      fetch: vi.fn(async (r: Req) => {
        if (href(r) in files) return new Response(files[href(r)])
        throw new TypeError('Failed to fetch')
      }),
    })
    const list = '<h1>Southbay Kitchen — 购物清单</h1><script src="/_next/static/chunks/list.js"></script>'
    expect(await (await open('/rooms/r1/shopping-list', Promise.resolve(html(list)))).text()).toBe(list)
    // The page itself wasn't fetched a second time: only the file it needs.
    expect(fetch.mock.calls.map(([r]) => href(r))).toEqual([`${ORIGIN}/_next/static/chunks/list.js`])
    expect([...caches.stores.get('pages-v1')!.keys()]).toEqual([`${ORIGIN}/rooms/r1/shopping-list`])
    expect([...caches.stores.get('files-v1')!.keys()]).toEqual([`${ORIGIN}/_next/static/chunks/list.js`])

    expect(await (await open('/rooms/r1/shopping-list', Promise.reject(new TypeError('Failed to fetch')))).text()).toBe(list)
  })
})
