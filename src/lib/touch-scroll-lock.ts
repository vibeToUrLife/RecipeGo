// Keeps a finger from scrolling the page behind an open dialog. Base UI locks
// the page by hiding its overflow, which iOS 26 no longer honours for touch —
// in every iOS browser, Chrome included, as they all run on Safari's engine — so
// a swipe on a dialog scrolled the plan behind it. Instead a swipe is cancelled
// unless it starts on something in a dialog that scrolls, like the recipe list.
// That keeps the swipe to itself at either end (DialogContent sets
// overscroll-behavior), so it never reaches the page either.
//
// Which way the finger moves isn't looked at: iOS takes a cancelled first move
// as "no scrolling for this whole swipe", and that first move is too small to
// tell up from sideways, so judging by it froze the list on a crooked swipe.

const DIALOG = '[data-slot="dialog-content"]'
const SCROLLS = /auto|scroll/

let locks = 0

// Whether `target` is in something in a dialog with more in it than fits, so a
// finger on it scrolls that. Outside every dialog nothing may scroll.
function inScroller(target: EventTarget | null): boolean {
  const dialog = target instanceof Element ? target.closest(DIALOG) : null
  if (!dialog) return false
  for (let el: Element | null = target as Element; el; el = el.parentElement) {
    const { overflowX, overflowY } = getComputedStyle(el)
    if (SCROLLS.test(overflowY) && el.scrollHeight > el.clientHeight) return true
    if (SCROLLS.test(overflowX) && el.scrollWidth > el.clientWidth) return true
    if (el === dialog) break
  }
  return false
}

function blockPageScroll(e: TouchEvent) {
  // Once something is scrolling the move can't be cancelled anyway, and two
  // fingers are a pinch: leave zooming alone.
  if (e.cancelable && e.touches.length === 1 && !inScroller(e.target)) e.preventDefault()
}

// Call while a dialog is open; returns the function that ends the lock. Open
// dialogs share one listener, removed when the last one closes.
export function lockTouchScroll(): () => void {
  if (locks++ === 0) document.addEventListener('touchmove', blockPageScroll, { passive: false })
  return () => {
    if (--locks === 0) document.removeEventListener('touchmove', blockPageScroll)
  }
}
