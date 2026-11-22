'use client'
import { useEffect, useEffectEvent, type RefObject } from 'react'
import { pinnedHeight } from '@/lib/pinned-height'

// Moving something about with a finger, as on a phone, where the browser's own
// drag and drop doesn't start from a touch. A press held still for HOLD_MS
// picks it up (with a buzz, where the phone can); from then the finger carries
// a copy of it about, the page scrolling when the finger nears the top or the
// bottom, and letting go drops it on whatever is under the finger. A finger
// that moves first is scrolling the page, and a quick tap is a tap: both are
// left to the browser.
//
// The page can only be kept from scrolling under the finger while nothing has
// started scrolling it (once iOS has, it ignores being asked to stop), so the
// press has to be held still: SLOP_PX of give, less than iOS's own before it
// starts to scroll.
export const HOLD_MS = 350
export const SLOP_PX = 8
// Within this far of the top (below what's pinned there) or of the bottom of
// the screen, the page scrolls, faster the nearer the edge, up to FASTEST_PX a
// frame.
const EDGE_PX = 72
const FASTEST_PX = 18

// How far to scroll this frame (negative: up) with the finger at y, between top
// and bottom.
export function edgeScroll(y: number, top: number, bottom: number): number {
  const into = (depth: number) => Math.ceil(FASTEST_PX * Math.min(1, depth / EDGE_PX))
  if (y < top + EDGE_PX) return -into(top + EDGE_PX - y)
  if (y > bottom - EDGE_PX) return into(y - (bottom - EDGE_PX))
  return 0
}

export interface TouchDragHandlers {
  // Picked up.
  onLift(): void
  // What's under the finger now: the `attribute` value of the nearest element
  // carrying it, or null over nothing that takes a drop.
  onOver(target: string | null): void
  // Let go, over that.
  onDrop(target: string | null): void
  // Dropped or not (another app took the touch, say): the drag is over.
  onEnd(): void
}

type TouchPoint = { identifier: number; clientX: number; clientY: number }
const ours = (list: TouchList | ArrayLike<TouchPoint>, id: number): TouchPoint | null => {
  for (let i = 0; i < list.length; i++) if (list[i].identifier === id) return list[i]
  return null
}

// Lets the element `ref` holds be dragged by a finger while `enabled`, onto the
// elements carrying `attribute`.
export function useTouchDrag(
  ref: RefObject<HTMLElement | null>,
  attribute: string,
  enabled: boolean,
  handlers: TouchDragHandlers,
): void {
  const lift = useEffectEvent(() => handlers.onLift())
  const over = useEffectEvent((target: string | null) => handlers.onOver(target))
  const drop = useEffectEvent((target: string | null) => handlers.onDrop(target))
  const end = useEffectEvent(() => handlers.onEnd())

  useEffect(() => {
    const el = ref.current
    if (!enabled || !el) return
    let pressing = false
    let lifted = false
    let id = 0
    let startX = 0
    let startY = 0
    let x = 0
    let y = 0
    let grabX = 0
    let grabY = 0
    let top = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let frame = 0
    let copy: HTMLElement | null = null
    let target: string | null = null

    const under = () => {
      const found = document.elementFromPoint(x, y)?.closest(`[${attribute}]`)?.getAttribute(attribute) ?? null
      if (found !== target) {
        target = found
        over(found)
      }
    }
    const place = () => {
      if (copy) copy.style.transform = `translate(${x - grabX}px, ${y - grabY}px) scale(1.03)`
    }
    const scroll = () => {
      const by = edgeScroll(y, top, window.innerHeight)
      if (by) {
        window.scrollBy(0, by)
        under()
      }
      frame = requestAnimationFrame(scroll)
    }
    const pickUp = () => {
      lifted = true
      try {
        navigator.vibrate?.(10)
      } catch {
        // No buzz to be had.
      }
      // A copy under the finger, held where it was taken hold of; the thing
      // itself stays put, for the handlers to show as picked up.
      const box = el.getBoundingClientRect()
      grabX = x - box.left
      grabY = y - box.top
      copy = el.cloneNode(true) as HTMLElement
      copy.setAttribute('aria-hidden', 'true')
      copy.inert = true
      copy.removeAttribute('id')
      Object.assign(copy.style, {
        position: 'fixed', left: '0', top: '0', margin: '0', width: `${box.width}px`,
        zIndex: '1000', pointerEvents: 'none', opacity: '0.95',
        boxShadow: '0 10px 24px rgb(0 0 0 / 0.25)', willChange: 'transform',
      })
      place()
      document.body.append(copy)
      top = pinnedHeight()
      lift()
      under()
      frame = requestAnimationFrame(scroll)
    }
    const finish = () => {
      clearTimeout(timer)
      cancelAnimationFrame(frame)
      copy?.remove()
      copy = null
      target = null
      const was = lifted
      pressing = lifted = false
      if (was) end()
    }

    const onStart = (e: TouchEvent) => {
      if (lifted) return // another finger, while one already carries it
      if (e.touches.length !== 1) return finish() // two fingers: a pinch
      const t = e.touches[0]
      pressing = true
      id = t.identifier
      startX = x = t.clientX
      startY = y = t.clientY
      clearTimeout(timer)
      timer = setTimeout(pickUp, HOLD_MS)
    }
    const onMove = (e: TouchEvent) => {
      const t = pressing ? ours(e.touches, id) : null
      if (!t) return
      x = t.clientX
      y = t.clientY
      if (!lifted) {
        // Moving before it was picked up: scrolling, so not a drag.
        if (Math.hypot(x - startX, y - startY) > SLOP_PX) {
          clearTimeout(timer)
          pressing = false
        }
        return
      }
      if (e.cancelable) e.preventDefault() // the page stays put under it
      place()
      under()
    }
    const onEnd = (e: TouchEvent) => {
      const t = pressing ? ours(e.changedTouches, id) : null
      if (!t) return
      if (lifted) {
        // And no tap on what the finger first pressed.
        if (e.cancelable) e.preventDefault()
        x = t.clientX
        y = t.clientY
        under()
        drop(target)
      }
      finish()
    }
    // A long press would open the phone's own menu on Android.
    const onMenu = (e: Event) => {
      if (pressing) e.preventDefault()
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: false })
    el.addEventListener('touchcancel', finish)
    el.addEventListener('contextmenu', onMenu)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', finish)
      el.removeEventListener('contextmenu', onMenu)
      finish()
    }
  }, [ref, attribute, enabled])
}
