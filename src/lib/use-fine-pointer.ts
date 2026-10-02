'use client'
import { useSyncExternalStore } from 'react'

const QUERY = '(pointer: fine)'

function subscribe(onChange: () => void) {
  if (typeof window.matchMedia !== 'function') return () => {}
  const mq = window.matchMedia(QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

// Whether the main pointer is a mouse or trackpad (a computer) rather than a
// finger (a phone or tablet). False on the server and for the hydration render,
// so the server's HTML and the browser's first render agree.
export function useFinePointer(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches,
    () => false,
  )
}
