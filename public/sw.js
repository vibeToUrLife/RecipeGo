// RecipeGo's service worker. Its jobs: keep the shopping list open in a shop
// with no signal, and show the notifications the server sends when someone in
// a room changes its meal plan or shopping list.
//
// - A shopping list page comes from the network when there is one, keeping a
//   copy; with none (or one too weak to bring it in a few seconds), the copy.
//   The list also asks for a fresh copy whenever it changes (a "keep"
//   message), as tapping to it from another page fetches no page to keep.
// - The app's built files a kept list needs (/_next/static) are kept with it.
//   Their names change with every build, so a kept one is never out of date,
//   and ones no kept list needs any more are cleared away.
// - Any other page asked for offline gets one listing the lists kept here.
// - The login page tells this when no one's signed in (a "forget" message):
//   the kept lists go.
// - A notification shows what changed; tapping it opens that list or plan, in
//   the app if it's open already.
const PAGES = 'pages-v1'
const FILES = 'files-v1'
const LIST = /^\/(rooms\/[^/]+\/)?shopping-list$/
const BUILT_FILE = /\/_next\/static\/[^"'\s\\<>()]+/g
const SLOW_MS = 6000

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key !== PAGES && key !== FILES) await caches.delete(key)
    }
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(builtFile(request))
  } else if (request.mode === 'navigate') {
    const fresh = fetch(request)
    if (LIST.test(url.pathname)) {
      // Cloned as soon as it arrives, before the page reads it.
      const since = forgotten
      event.waitUntil(fresh.then((response) => store(url.pathname, response.clone(), since)).catch(() => {}))
      event.respondWith(list(url.pathname, fresh))
    } else {
      event.respondWith(fresh.catch(() => offlinePage()))
    }
  }
})

self.addEventListener('message', (event) => {
  const { type, path } = event.data ?? {}
  if (type === 'keep' && typeof path === 'string' && LIST.test(path)) event.waitUntil(keep(path))
  else if (type === 'forget') event.waitUntil(forget())
})

// Every push is shown (a phone may stop delivering them to a site that
// doesn't), with a title and body the server wrote in this phone's language.
self.addEventListener('push', (event) => {
  let notice = {}
  try {
    notice = event.data?.json() ?? {}
  } catch {
    // Not one of ours: shown plainly.
  }
  event.waitUntil(self.registration.showNotification(notice.title || 'RecipeGo', {
    body: notice.body || '',
    tag: notice.tag,
    icon: '/icon-192.png',
    data: { url: notice.url || '/' },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/', self.location.origin)
  if (url.origin !== self.location.origin) return
  event.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const app = open.find((client) => new URL(client.url).origin === url.origin)
    if (app) {
      await app.focus()
      // A page this worker doesn't control can't be sent elsewhere from here.
      if (await app.navigate(url.href).catch(() => null)) return
    }
    await self.clients.openWindow(url.href)
  })())
})

async function builtFile(request) {
  return (await caches.match(request, { cacheName: FILES })) ?? fetch(request)
}

async function list(path, fresh) {
  const kept = await caches.match(path, { cacheName: PAGES })
  if (!kept) return fresh.catch(() => offlinePage())
  const slow = new Promise((resolve) => setTimeout(resolve, SLOW_MS, kept))
  return Promise.race([fresh, slow]).catch(() => kept)
}

// One fetch per list at a time, however many changes ask for it.
const keeping = new Map()
function keep(path) {
  if (!keeping.has(path)) {
    const since = forgotten
    keeping.set(path, fetch(path, { credentials: 'same-origin' })
      .then((response) => store(path, response, since))
      .catch(() => {})
      .finally(() => keeping.delete(path)))
  }
  return keeping.get(path)
}

// Lists are kept one at a time, so clearing away the files one no longer needs
// never takes a file another is still fetching for. A list asked for before
// the last "forget" isn't kept: its owner may have just signed out.
let storing = Promise.resolve()
let forgotten = 0
function store(path, response, since) {
  storing = storing.then(() => since === forgotten && keepList(path, response)).catch(() => {})
  return storing
}

function forget() {
  forgotten++
  storing = storing.then(() => Promise.all([caches.delete(PAGES), caches.delete(FILES)])).catch(() => {})
  return storing
}

// Only a list itself: not the login page a signed-out visit is sent to.
async function keepList(path, response) {
  if (!response.ok || response.redirected || !(response.headers.get('content-type') ?? '').includes('text/html')) return
  const pages = await caches.open(PAGES)
  await pages.put(path, response)
  const needed = new Set()
  for (const request of await pages.keys()) {
    const html = await (await pages.match(request)).text()
    for (const file of html.match(BUILT_FILE) ?? []) needed.add(new URL(file, self.location.origin).href)
  }
  const files = await caches.open(FILES)
  for (const request of await files.keys()) {
    if (!needed.delete(request.url)) await files.delete(request)
  }
  await Promise.all([...needed].map(async (file) => {
    const fetched = await fetch(file)
    if (fetched.ok) await files.put(file, fetched)
  }))
}

async function offlinePage() {
  const pages = await caches.open(PAGES)
  const links = []
  for (const request of await pages.keys()) {
    const path = new URL(request.url).pathname
    const html = await (await pages.match(request)).text()
    // The list's heading names it ("Southbay Kitchen — 购物清单"); its text is
    // already escaped, and with the tags gone holds no markup.
    const name = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1].replace(/<[^>]*>/g, '').trim() || path
    links.push(`<li><a href="${path}">${name}</a></li>`)
  }
  const lists = links.length
    ? `<p>可以打开这台手机上存着的购物清单 · Shopping lists kept on this phone:</p><ul>${links.join('')}</ul>`
    : '<p>这台手机上还没有存下购物清单。联网时打开一次购物清单，之后没网也能看。<br>No shopping list is kept on this phone yet: open one while online, and it will be here offline.</p>'
  return new Response(`<!doctype html>
<html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>RecipeGo</title>
<style>
  :root { color-scheme: light dark; --bg: #fefdfc; --fg: #3b2f25; --accent: #c65d3b; }
  @media (prefers-color-scheme: dark) { :root { --bg: #0a0907; --fg: #f3f1ec; --accent: #e07a4d; } }
  body { margin: 0; padding: 2rem 1.25rem; background: var(--bg); color: var(--fg); font: 16px/1.6 system-ui, sans-serif; }
  h1 { color: var(--accent); font-size: 1.4rem; margin: 0 0 1rem; }
  a { color: var(--accent); font-size: 1.1rem; }
  li { margin: .5rem 0; }
</style></head>
<body><h1>没有网络 · Offline</h1>${lists}</body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
