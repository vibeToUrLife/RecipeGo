'use client'
import { useEffect } from 'react'

// Registers public/sw.js, which keeps the shopping list open with no signal.
// Not in development, where it would hold on to files from old builds.
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('Service worker not registered', err))
  }, [])
  return null
}
