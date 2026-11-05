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
//   the kept lists go, and the welcome animation's copy till the next page.
// - A notification shows what changed; tapping it opens that list or plan, in
//   the app if it's open already.
// - Opening a page doesn't wait for this worker to start up (on a phone, after
//   a while away, that takes a moment) before asking the server for it: the
//   browser asks straight away, and this takes what comes back (navigation
//   preload).
// - Opening the app ("/") shows the welcome animation at once, from a copy of
//   it kept here, rather than after the server has answered, which can take
//   seconds when it has been asleep. The copy is taken from each page opened
//   (the animation, the page's stylesheet and fonts, kept with it), and goes
//   on to the page proper, which carries the animation on from where it had
//   got (lib/welcome.ts).
const PAGES = 'pages-v1'
const FILES = 'files-v1'
const SHELL = 'shell-v1'
const WELCOME = '/__welcome'
const WELCOMED_KEY = 'recipego:welcomed'
const SPLASH_STARTED_KEY = 'recipego:splash-started'
const LIST = /^\/(rooms\/[^/]+\/)?shopping-list$/
const BUILT_FILE = /\/_next\/static\/[^"'\s\\<>()]+/g
const SLOW_MS = 6000

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key !== PAGES && key !== FILES && key !== SHELL) await caches.delete(key)
    }
    await self.registration.navigationPreload?.enable().catch(() => {})
    await self.clients.claim()
    // A copy of the welcome animation from the start, rather than only once
    // a page has been opened through this worker. Not waited for: the pages
    // this worker now looks after can't be answered until it's active.
    fetch('/login', { credentials: 'same-origin' }).then((response) => storeWelcome(response, forgotten)).catch(() => {})
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
    if (url.pathname === '/' && !url.search) {
      // Opening the app. The page the browser fetched ahead isn't used when
      // the welcome animation is (it has woken the server up, though).
      event.waitUntil(Promise.resolve(event.preloadResponse).catch(() => {}))
      event.respondWith(opening(event))
      return
    }
    const fresh = fromServer(event)
    const isList = LIST.test(url.pathname)
    // Copied as soon as it arrives, before the page reads it: a list to keep,
    // and the welcome animation.
    const since = forgotten
    event.waitUntil(fresh.then((response) => Promise.all([
      isList && store(url.pathname, response.clone(), since),
      storeWelcome(response.clone(), since),
    ])).catch(() => {}))
    event.respondWith(isList ? list(url.pathname, fresh) : fresh.catch(() => offlinePage()))
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

// The page from the server: the one the browser started fetching while this
// was starting up, or, where it didn't (preload off, or not supported), one
// fetched now. No signal fails either way, for the caller to deal with.
async function fromServer(event) {
  return (await event.preloadResponse) ?? fetch(event.request)
}

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

// Lists, and the welcome animation, are kept one at a time, so clearing away
// the files one no longer needs never takes a file another is still fetching
// for. Nothing asked for before the last "forget" is kept: its owner may have
// just signed out.
let storing = Promise.resolve()
let forgotten = 0
function store(path, response, since) {
  storing = storing.then(() => since === forgotten && keepList(path, response)).catch(() => {})
  return storing
}

function storeWelcome(response, since) {
  storing = storing.then(() => since === forgotten && keepWelcome(response)).catch(() => {})
  return storing
}

function forget() {
  forgotten++
  storing = storing.then(() => Promise.all([caches.delete(PAGES), caches.delete(FILES), caches.delete(SHELL)])).catch(() => {})
  return storing
}

// A page as the server drew it: not a redirect (to the login page, say), nor
// an error page.
function keepable(response) {
  return response.ok && !response.redirected && (response.headers.get('content-type') ?? '').includes('text/html')
}

async function keepList(path, response) {
  if (!keepable(response)) return
  await (await caches.open(PAGES)).put(path, response)
  await keepFiles()
}

async function keepWelcome(response) {
  if (!keepable(response)) return
  const welcome = welcomePage(await response.text())
  if (!welcome) return
  const shell = await caches.open(SHELL)
  const kept = await shell.match(WELCOME)
  if (kept && (await kept.text()) === welcome && (await keptWelcome())) return
  await shell.put(WELCOME, new Response(welcome, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }))
  await keepFiles()
}

// The built files the kept lists and welcome animation need, and the fonts
// their stylesheets draw text with; and none other.
async function keepFiles() {
  const needed = new Set()
  for (const name of [PAGES, SHELL]) {
    const cache = await caches.open(name)
    for (const request of await cache.keys()) {
      const html = await (await cache.match(request)).text()
      for (const file of html.match(BUILT_FILE) ?? []) needed.add(new URL(file, self.location.origin).href)
    }
  }
  const files = await caches.open(FILES)
  for (const sheet of [...needed].filter((file) => new URL(file).pathname.endsWith('.css'))) {
    let css = await files.match(sheet)
    if (!css) {
      const fetched = await fetch(sheet).catch(() => null)
      if (!fetched?.ok) continue
      await files.put(sheet, fetched.clone())
      css = fetched
    }
    for (const [, font] of (await css.text()).matchAll(/url\(([^)'"]+\.woff2)\)/g)) needed.add(new URL(font, sheet).href)
  }
  for (const request of await files.keys()) {
    if (!needed.delete(request.url)) await files.delete(request)
  }
  await Promise.all([...needed].map(async (file) => {
    const fetched = await fetch(file)
    if (fetched.ok) await files.put(file, fetched)
  }))
}

// Opening the app: the welcome animation kept here, at once, which goes on to
// the page proper; with none kept, the page.
async function opening(event) {
  return (await keptWelcome()) ?? fromServer(event).catch(() => offlinePage())
}

// The kept welcome animation, if its stylesheet is kept too: drawn without
// it, it would be a mess, and the page is better.
async function keptWelcome() {
  const welcome = await caches.match(WELCOME, { cacheName: SHELL })
  if (!welcome) return null
  for (const file of (await welcome.clone().text()).match(BUILT_FILE) ?? []) {
    if (!(await caches.match(new URL(file, self.location.origin).href, { cacheName: FILES }))) return null
  }
  return welcome
}

// Before the animation: the theme, as the page's own script sets it (the
// "theme" next-themes keeps, the phone's own by default); and, in a session
// that hasn't seen the animation, when it started, for the page proper to
// carry it on from. One that has gets the page's colour, and no animation.
const WELCOME_SCRIPT = `(function(){var d=document.documentElement;try{var t=localStorage.getItem('theme')||'system';if(t==='system')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';if(t==='dark'||t==='light'){d.classList.add(t);d.style.colorScheme=t}}catch(e){}try{if(sessionStorage.getItem('${WELCOMED_KEY}'))d.setAttribute('data-welcomed','');else sessionStorage.setItem('${SPLASH_STARTED_KEY}',String(Date.now()))}catch(e){}})()`

// The welcome animation alone, out of a page as the server drew it: the page's
// <html> and <body> (its fonts), stylesheet and theme colours, and the
// animation, held there (no React here to time it: it stays until the page
// proper takes over). After it, the page proper: /?launch, which the server
// sends on to the room used last, as it does "/". None for a page without it.
function welcomePage(html) {
  const head = html.slice(0, Math.max(0, html.indexOf('</head>')))
  const htmlTag = /<html[^>]*>/.exec(head)?.[0]
  const bodyTag = /<body[^>]*>/.exec(html)?.[0]
  const sheets = head.match(/<link[^>]*rel="stylesheet"[^>]*>/g)
  const at = html.indexOf('data-testid="splash"')
  if (!htmlTag || !bodyTag || !sheets || at < 0) return null
  // The animation's element, to its own closing tag.
  const start = html.lastIndexOf('<div', at)
  const divs = /<(\/?)div\b[^>]*>/g
  divs.lastIndex = start
  let depth = 0
  let end = -1
  for (let tag = divs.exec(html); tag; tag = divs.exec(html)) {
    depth += tag[1] ? -1 : 1
    if (depth === 0) {
      end = divs.lastIndex
      break
    }
  }
  if (end < 0) return null
  const splash = html.slice(start, end).replace('class="splash"', 'class="splash splash--held"')
  const colours = head.match(/<meta[^>]*name="theme-color"[^>]*>/g) ?? []
  return '<!doctype html>' + htmlTag +
    '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>RecipeGo</title>' +
    colours.join('') + sheets.join('') + `<script>${WELCOME_SCRIPT}</script></head>` +
    bodyTag + splash + "<script>location.replace('/?launch')</script></body></html>"
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
