'use client'
import { useEffect } from 'react'
import { reloadToRecover } from '@/lib/recover'

// A new version of the app goes out while this one is open: what the old one
// sends the server (each server action has an id that's this version's own)
// isn't known there any more, and every tap that saves something would fail
// with "please try again", which never helps. Next marks such a reply
// (x-nextjs-action-not-found); seeing one, the page reloads itself into the
// new version, over the welcome animation (lib/recover.ts), and the action
// that was refused is left hanging rather than reporting a failure first.
//
// Every server action goes out through fetch, so this watches what comes back
// there, and passes everything else through untouched.
export function ReloadWhenStale() {
  useEffect(() => {
    const original = window.fetch
    const watched: typeof fetch = async (input, init) => {
      const res = await original(input, init)
      if (res.headers.get('x-nextjs-action-not-found') === '1' && reloadToRecover()) {
        return new Promise<Response>(() => {})
      }
      return res
    }
    window.fetch = watched
    return () => {
      if (window.fetch === watched) window.fetch = original
    }
  }, [])
  return null
}
