import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SPLASH_STARTED_KEY, WELCOMED_KEY } from '@/lib/welcome'

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
  const fire = async (type: string, event: object) => {
    const waits: Promise<unknown>[] = []
    handlers[type]({ ...event, waitUntil: (p: Promise<unknown>) => waits.push(p) })
    await Promise.all(waits)
  }
  return { self, fetch, caches, activate, open, fire }
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

// A page as the server draws it, cut down: the welcome animation first in its
// body, then the page itself and its scripts.
const PAGE = '<!DOCTYPE html><html lang="zh" class="inter_v fraunces_v"><head><meta charSet="utf-8"/>' +
  '<link rel="stylesheet" href="/_next/static/chunks/app.css" data-precedence="next"/>' +
  '<script src="/_next/static/chunks/main.js" async=""></script>' +
  '<meta name="theme-color" content="#0a0907" media="(prefers-color-scheme: dark)"/></head>' +
  '<body class="font-sans antialiased"><div hidden=""><!--$--><!--/$--></div><script>early()</script>' +
  '<div aria-hidden="true" data-testid="splash" class="splash"><div class="splash-inner"><svg class="splash-egg"><path class="splash-white"></path></svg>' +
  '<p class="splash-name font-serif"><span style="--i:0">R</span></p><p class="splash-tagline">把菜谱变成购物清单</p></div></div>' +
  '<main><h1>Southbay Kitchen</h1></main><script>self.__next_f.push([1,"room"])</script></body></html>'
const CSS = '@font-face{font-family:Fraunces;src:url(../media/fraunces.woff2)format("woff2")}.splash{background:#c65d3b}'

// The site's built files, and its pages; no signal for anything else.
function site(pages: Record<string, string> = {}) {
  const files: Record<string, string> = {
    [`${ORIGIN}/_next/static/chunks/app.css`]: CSS,
    [`${ORIGIN}/_next/static/media/fraunces.woff2`]: 'font',
    [`${ORIGIN}/_next/static/chunks/list.js`]: 'list()',
    [`${ORIGIN}/_next/static/chunks/list2.js`]: 'list2()',
  }
  return vi.fn(async (r: Req) => {
    if (href(r) in files) return new Response(files[href(r)])
    const page = pages[new URL(href(r)).pathname]
    if (page) return html(page)
    throw new TypeError('Failed to fetch')
  })
}
const kept = async (caches: ReturnType<typeof cacheStorage>, name: string) => [...(caches.stores.get(name)?.keys() ?? [])]
const keptWelcome = async (caches: ReturnType<typeof cacheStorage>) => (await caches.match('/__welcome', { cacheName: 'shell-v1' }))?.text()

describe('the welcome animation, from the service worker', () => {
  it('keeps a copy of it from a page opened: the animation alone, with the page’s stylesheet and fonts', async () => {
    const { caches, open } = worker({ fetch: site() })
    await open('/rooms/r1', Promise.resolve(html(PAGE)))
    const welcome = (await keptWelcome(caches))!
    expect(welcome).toMatch(/^<!doctype html><html lang="zh" class="inter_v fraunces_v"><head>/)
    expect(welcome).toContain('<link rel="stylesheet" href="/_next/static/chunks/app.css" data-precedence="next"/>')
    expect(welcome).toContain('<meta name="theme-color" content="#0a0907" media="(prefers-color-scheme: dark)"/>')
    expect(welcome).toContain('<body class="font-sans antialiased">')
    // Held: with no React here to time it, it stays until the page takes over.
    expect(welcome).toContain('<div aria-hidden="true" data-testid="splash" class="splash splash--held"><div class="splash-inner">')
    expect(welcome).toContain('<p class="splash-tagline">把菜谱变成购物清单</p></div></div>')
    expect(welcome).toMatch(/<script>location\.replace\('\/\?launch'\)<\/script><\/body><\/html>$/)
    // Nothing of the page itself, nor its scripts.
    for (const left of ['Southbay Kitchen', 'main.js', '__next_f', 'early()']) expect(welcome).not.toContain(left)
    expect(await kept(caches, 'files-v1')).toEqual(expect.arrayContaining([`${ORIGIN}/_next/static/chunks/app.css`, `${ORIGIN}/_next/static/media/fraunces.woff2`]))
  })

  it('takes one when it takes over, before any page has been opened through it', async () => {
    const { caches, activate } = worker({ fetch: site({ '/login': PAGE }) })
    await activate()
    await vi.waitFor(async () => expect(await keptWelcome(caches)).toContain('splash--held'))
  })

  it('opens the app with it at once, and the page the browser fetched ahead goes unused', async () => {
    const { fetch, caches, open } = worker({ fetch: site() })
    await open('/rooms/r1', Promise.resolve(html(PAGE)))
    fetch.mockClear()
    const opened = await open('/', Promise.resolve(html('the room, from the server')))
    expect(await opened.text()).toBe(await keptWelcome(caches))
    expect(fetch).not.toHaveBeenCalled()
  })

  it('opens the page itself without a copy, or with its stylesheet gone', async () => {
    const none = worker({ fetch: site() })
    expect(await (await none.open('/', Promise.resolve(html('the room')))).text()).toBe('the room')

    const unstyled = worker({ fetch: site() })
    await unstyled.open('/rooms/r1', Promise.resolve(html(PAGE)))
    unstyled.caches.stores.get('files-v1')!.delete(`${ORIGIN}/_next/static/chunks/app.css`)
    expect(await (await unstyled.open('/', Promise.resolve(html('the room')))).text()).toBe('the room')
  })

  it('answers nothing but opening the app with it', async () => {
    const { open } = worker({ fetch: site() })
    await open('/rooms/r1', Promise.resolve(html(PAGE)))
    for (const path of ['/?launch', '/?home', '/rooms/r1', '/plan']) {
      expect(await (await open(path, Promise.resolve(html(`page ${path}`)))).text()).toBe(`page ${path}`)
    }
  })

  it('leaves the copy be for a page without the animation', async () => {
    const { caches, open } = worker({ fetch: site() })
    await open('/rooms/r1', Promise.resolve(html(PAGE)))
    const before = await keptWelcome(caches)
    await open('/plan', Promise.resolve(html('<h1>not found</h1>')))
    expect(await keptWelcome(caches)).toBe(before)
  })

  it('keeps its files when a kept list’s old files are cleared away', async () => {
    const { caches, open } = worker({ fetch: site() })
    await open('/rooms/r1', Promise.resolve(html(PAGE)))
    await open('/shopping-list', Promise.resolve(html('<h1>购物清单</h1><script src="/_next/static/chunks/list.js"></script>')))
    await open('/shopping-list', Promise.resolve(html('<h1>购物清单</h1><script src="/_next/static/chunks/list2.js"></script>')))
    expect((await kept(caches, 'files-v1')).sort()).toEqual([
      `${ORIGIN}/_next/static/chunks/app.css`,
      `${ORIGIN}/_next/static/chunks/list2.js`,
      `${ORIGIN}/_next/static/media/fraunces.woff2`,
    ])
  })

  it('isn’t listed with the kept lists offline, and goes on signing out', async () => {
    const { caches, open, fire } = worker({ fetch: site() })
    await open('/rooms/r1', Promise.resolve(html(PAGE)))
    await open('/shopping-list', Promise.resolve(html('<h1>购物清单</h1>')))
    const offline = await (await open('/plan', Promise.reject(new TypeError('Failed to fetch')))).text()
    expect(offline).toContain('href="/shopping-list"')
    expect(offline).not.toContain('__welcome')

    await fire('message', { data: { type: 'forget' } })
    expect(await keptWelcome(caches)).toBeUndefined()
    expect(await kept(caches, 'files-v1')).toEqual([])
  })
})

describe('the welcome animation’s copy, opened', () => {
  // Its first script, run as the copy opens.
  const firstScript = async () => {
    const { caches, open } = worker({ fetch: site() })
    await open('/rooms/r1', Promise.resolve(html(PAGE)))
    return /<script>([\s\S]*?)<\/script><\/head>/.exec((await keptWelcome(caches))!)![1]
  }
  afterEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    document.documentElement.className = ''
    document.documentElement.removeAttribute('style')
    document.documentElement.removeAttribute('data-welcomed')
  })

  it('takes the theme the app keeps, and notes when it started, for the page to carry it on from', async () => {
    localStorage.setItem('theme', 'dark')
    const before = Date.now()
    new Function(await firstScript())()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(Number(sessionStorage.getItem(SPLASH_STARTED_KEY))).toBeGreaterThanOrEqual(before)
  })

  it('shows no animation in a session that has seen it', async () => {
    sessionStorage.setItem(WELCOMED_KEY, '1')
    new Function(await firstScript())()
    expect(document.documentElement.hasAttribute('data-welcomed')).toBe(true)
    expect(sessionStorage.getItem(SPLASH_STARTED_KEY)).toBeNull()
  })
})
