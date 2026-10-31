// Keeps a finger from scrolling the page behind an open dialog. Base UI locks
// the page by hiding its overflow, which iOS 26 no longer honours for touch —
// in every iOS browser, Chrome included, as they all run on Safari's engine — so
// a swipe on a dialog scrolled the plan behind it. Instead a swipe is cancelled
// unless something in a dialog under the finger can still scroll that way.

const DIALOG = '[data-slot="dialog-content"]'

let locks = 0
let startX = 0
let startY = 0

function rememberStart(e: TouchEvent) {
  startX = e.touches[0].clientX
  startY = e.touches[0].clientY
}

// Whether a finger dragged (dx, dy) from `target` scrolls something between it
// and its dialog. Outside every dialog nothing may scroll.
function canScroll(target: EventTarget | null, dx: number, dy: number): boolean {
  const dialog = target instanceof Element ? target.closest(DIALOG) : null
  if (!dialog) return false
  const vertical = Math.abs(dy) >= Math.abs(dx)
  const delta = vertical ? dy : dx
  for (let el: Element | null = target as Element; el; el = el.parentElement) {
    const style = getComputedStyle(el)
    const overflow = vertical ? style.overflowY : style.overflowX
    if (overflow === 'auto' || overflow === 'scroll') {
      const pos = vertical ? el.scrollTop : el.scrollLeft
      const max = vertical ? el.scrollHeight - el.clientHeight : el.scrollWidth - el.clientWidth
      // A finger moving down (or right) scrolls back towards the start.
      if (max > 0 && (delta > 0 ? pos > 0 : delta < 0 ? Math.ceil(pos) < max : true)) return true
    }
    if (el === dialog) break
  }
  return false
}

function blockPageScroll(e: TouchEvent) {
  // Once something is scrolling the move can't be cancelled anyway, and two
  // fingers are a pinch: leave zooming alone.
  if (!e.cancelable || e.touches.length !== 1) return
  const { clientX, clientY } = e.touches[0]
  if (!canScroll(e.target, clientX - startX, clientY - startY)) e.preventDefault()
}

// Call while a dialog is open; returns the function that ends the lock. Open
// dialogs share one pair of listeners, removed when the last one closes.
export function lockTouchScroll(): () => void {
  if (locks++ === 0) {
    document.addEventListener('touchstart', rememberStart, { passive: true })
    document.addEventListener('touchmove', blockPageScroll, { passive: false })
  }
  return () => {
    if (--locks === 0) {
      document.removeEventListener('touchstart', rememberStart)
      document.removeEventListener('touchmove', blockPageScroll)
    }
  }
}
