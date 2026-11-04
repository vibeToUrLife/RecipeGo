'use client'
import { WELCOMED_KEY } from '@/lib/welcome'

// When something fails in a way a fresh copy of the page fixes, the page
// reloads itself instead of showing an error with a Retry button, and the
// welcome animation plays over the reload. Most often that's a new version of
// the app having gone out while this one was open: what this one asks the
// server for isn't there any more, and trying again changes nothing; a reload
// fetches the new one.
//
// Twice at most in a minute. Past that something's wrong that reloading won't
// fix (the database down, say), and the error shows after all. And not at all
// if this tab can't keep count, as then it could reload for ever.
const KEY = 'recipego:recovering'
const WINDOW_MS = 60_000
const TRIES = 2

type Tries = { first: number; count: number }

// Through here, so tests can stand in for it (jsdom won't let location be).
export const page = { reload: () => window.location.reload() }

function tries(): Tries | null {
  try {
    sessionStorage.setItem('recipego:can-count', '1')
    sessionStorage.removeItem('recipego:can-count')
    const saved = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as Tries | null
    return saved && Date.now() - saved.first < WINDOW_MS ? saved : { first: Date.now(), count: 0 }
  } catch {
    return null
  }
}

export function canReloadToRecover(): boolean {
  const t = tries()
  return t !== null && t.count < TRIES
}

// Reloads, counting the try, if it can; false if it can't.
export function reloadToRecover(): boolean {
  const t = tries()
  if (!t || t.count >= TRIES) return false
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ first: t.first, count: t.count + 1 }))
    sessionStorage.removeItem(WELCOMED_KEY)
  } catch {
    return false
  }
  page.reload()
  return true
}
