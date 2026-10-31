import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { lockTouchScroll } from '@/lib/touch-scroll-lock'

// jsdom has no Touch constructor, and the lock only reads where each finger is,
// so a plain event carrying `touches` stands in for one.
function touch(type: 'touchstart' | 'touchmove', target: Element, fingers: [number, number][]): boolean {
  const e = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(e, 'touches', { value: fingers.map(([clientX, clientY]) => ({ clientX, clientY })) })
  target.dispatchEvent(e)
  return e.defaultPrevented
}

// Drags one finger (dx, dy) from `target`; true if the move was cancelled.
function swipeCancelled(target: Element, dy: number, dx = 0): boolean {
  touch('touchstart', target, [[100, 100]])
  return touch('touchmove', target, [[100 + dx, 100 + dy]])
}

// The page, and a dialog over it holding a heading and a list that scrolls
// 300px (jsdom does no layout, so the list's size is set by hand).
function renderDialog() {
  document.body.innerHTML = `
    <main id="page"></main>
    <div data-slot="dialog-content">
      <h2 id="title">Pick a recipe</h2>
      <div id="list" style="overflow-y: auto"><button id="item">Roast chicken</button></div>
    </div>`
  const get = (id: string) => document.getElementById(id)!
  Object.defineProperties(get('list'), {
    scrollHeight: { value: 500 },
    clientHeight: { value: 200 },
    scrollTop: { value: 0, writable: true },
  })
  return { page: get('page'), title: get('title'), list: get('list'), item: get('item') }
}

describe('lockTouchScroll', () => {
  describe('while a dialog is open', () => {
    let unlock: () => void
    beforeEach(() => { unlock = lockTouchScroll() })
    afterEach(() => unlock())

    it('stops a swipe on the page behind the dialog', () => {
      const { page } = renderDialog()
      expect(swipeCancelled(page, -50)).toBe(true)
    })

    it("stops a swipe on a part of the dialog that doesn't scroll", () => {
      const { title } = renderDialog()
      expect(swipeCancelled(title, -50)).toBe(true)
    })

    it('lets a list in the dialog scroll, but not on past either end', () => {
      const { list, item } = renderDialog()
      // At the top: further down the list, yes; pulling down for more, no.
      expect(swipeCancelled(item, -50)).toBe(false)
      expect(swipeCancelled(item, 50)).toBe(true)
      // At the bottom: back up, yes; on down, no.
      list.scrollTop = 300
      expect(swipeCancelled(item, 50)).toBe(false)
      expect(swipeCancelled(item, -50)).toBe(true)
    })

    it('stops a sideways swipe on a list that only scrolls up and down', () => {
      const { list, item } = renderDialog()
      list.scrollTop = 100
      expect(swipeCancelled(item, 5, -50)).toBe(true)
    })

    it('leaves a two-finger pinch alone, so the page can still be zoomed', () => {
      const { page } = renderDialog()
      touch('touchstart', page, [[100, 100], [200, 200]])
      expect(touch('touchmove', page, [[90, 90], [210, 210]])).toBe(false)
    })
  })

  it('lets the page scroll again once the last open dialog closes', () => {
    const { page } = renderDialog()
    const unlockFirst = lockTouchScroll()
    const unlockSecond = lockTouchScroll()
    unlockFirst()
    expect(swipeCancelled(page, -50)).toBe(true)
    unlockSecond()
    expect(swipeCancelled(page, -50)).toBe(false)
  })
})
