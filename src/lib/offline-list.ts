'use client'
import { useSyncExternalStore } from 'react'

// The shopping list's side of working with no signal (the rest is public/sw.js).

// Whether the phone has a connection. Assumed so on the server and for the
// hydration render, so the two render alike.
export function useOnline(): boolean {
  return useSyncExternalStore(
    (changed) => {
      window.addEventListener('online', changed)
      window.addEventListener('offline', changed)
      return () => {
        window.removeEventListener('online', changed)
        window.removeEventListener('offline', changed)
      }
    },
    () => navigator.onLine,
    () => true,
  )
}

// Ticks made with no signal, by item id, kept on this phone until they're sent.
// Each is cleared once it's been sent, so one that fails waits for the next try.
const KEY = 'recipego:unsent-ticks'
export type Ticks = Record<string, boolean>
const NONE: Ticks = {}
let ticks: Ticks | null = null
const listeners = new Set<() => void>()

function read(): Ticks {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Ticks
  } catch {
    return {}
  }
}

function write(next: Ticks) {
  ticks = next
  try {
    if (Object.keys(next).length) localStorage.setItem(KEY, JSON.stringify(next))
    else localStorage.removeItem(KEY)
  } catch {
    // Storage blocked: the ticks last as long as the page does.
  }
  listeners.forEach((l) => l())
}

export const unsentTicks = (): Ticks => (ticks ??= read())

export function rememberTick(id: string, checked: boolean) {
  write({ ...unsentTicks(), [id]: checked })
}

export function forgetTick(id: string) {
  if (!(id in unsentTicks())) return
  const { [id]: _sent, ...rest } = unsentTicks()
  write(rest)
}

// Another tab of the app keeping or sending ticks counts here too.
function fromOtherTab(e: StorageEvent) {
  if (e.key !== KEY && e.key !== null) return
  ticks = null
  listeners.forEach((l) => l())
}

export function useUnsentTicks(): Ticks {
  return useSyncExternalStore(
    (changed) => {
      if (!listeners.size) window.addEventListener('storage', fromOtherTab)
      listeners.add(changed)
      return () => {
        listeners.delete(changed)
        if (!listeners.size) window.removeEventListener('storage', fromOtherTab)
      }
    },
    unsentTicks,
    () => NONE,
  )
}

// Sends the kept ticks one at a time, each forgotten once it's gone (or sent
// again if it was changed meanwhile). Stops at the first that fails: with no
// signal, the rest would too. A call while a send is under way joins it.
let sending: Promise<void> | null = null

export function sendUnsentTicks(send: (id: string, checked: boolean) => Promise<unknown>): Promise<void> {
  sending ??= sendEach(send).finally(() => {
    sending = null
  })
  return sending
}

async function sendEach(send: (id: string, checked: boolean) => Promise<unknown>) {
  try {
    for (let id = Object.keys(unsentTicks())[0]; id !== undefined; id = Object.keys(unsentTicks())[0]) {
      const checked = unsentTicks()[id]
      await send(id, checked)
      if (unsentTicks()[id] === checked) forgetTick(id)
    }
  } catch {
    // Kept for the next try.
  }
}

// Asks the service worker to keep a fresh copy of this list for offline. It
// may still be starting up on the first visit, so this waits for it.
export function keepForOffline(path: string) {
  navigator.serviceWorker?.ready.then((reg) => reg.active?.postMessage({ type: 'keep', path })).catch(() => {})
}

// No one's signed in, so the lists kept on this phone go. (Kept ticks stay:
// they're just item ids, sent once someone who can see those items is back.)
export function forgetOfflineLists() {
  navigator.serviceWorker?.ready.then((reg) => reg.active?.postMessage({ type: 'forget' })).catch(() => {})
}
