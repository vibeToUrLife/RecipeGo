import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { lockTouchScroll } from '@/lib/touch-scroll-lock'

// Moves fingers on `target`; true if the move was cancelled. jsdom has no Touch
// constructor, so a plain event carries the `touches`.
function moveCancelled(target: Element, fingers: [number, number][]): boolean {
  const e = new Event('touchmove', { bubbles: true, cancelable: true })
  Object.defineProperty(e, 'touches', { value: fingers.map(([clientX, clientY]) => ({ clientX, clientY })) })
  target.dispatchEvent(e)
  return e.defaultPrevented
}

const swipeCancelled = (target: Element) => moveCancelled(target, [[100, 50]])

// The page, and a dialog over it holding a heading and a list of recipes
// `listHeight` tall in a 200px box (jsdom does no layout, so sizes are set by hand).
function renderDialog(listHeight: number) {
  document.body.innerHTML = `
    <main id="page"></main>
    <div data-slot="dialog-content">
      <h2 id="title">Pick a recipe</h2>
      <div id="list" style="overflow-y: auto"><button id="item">Roast chicken</button></div>
    </div>`
  const get = (id: string) => document.getElementById(id)!
  Object.defineProperties(get('list'), {
    scrollHeight: { value: listHeight },
    clientHeight: { value: Math.min(listHeight, 200) },
  })
  return { page: get('page'), title: get('title'), item: get('item') }
}

describe('lockTouchScroll', () => {
  describe('while a dialog is open', () => {
    let unlock: () => void
    beforeEach(() => { unlock = lockTouchScroll() })
    afterEach(() => unlock())

    it('stops a swipe on the page behind the dialog', () => {
      const { page } = renderDialog(500)
      expect(swipeCancelled(page)).toBe(true)
    })

    it("stops a swipe on a part of the dialog that doesn't scroll", () => {
      const { title } = renderDialog(500)
      expect(swipeCancelled(title)).toBe(true)
    })

    // Whichever way the first, tiny move happens to point: on iOS a cancelled
    // first move would freeze the list for the whole swipe.
    it('leaves every swipe on a list with more in it than fits to the list', () => {
      const { item } = renderDialog(500)
      expect(moveCancelled(item, [[100, 99]])).toBe(false)
      expect(moveCancelled(item, [[102, 100]])).toBe(false)
      expect(moveCancelled(item, [[100, 101]])).toBe(false)
    })

    it('stops a swipe on a list whose recipes all fit, as there is nothing to scroll', () => {
      const { item } = renderDialog(150)
      expect(swipeCancelled(item)).toBe(true)
    })

    it('leaves a two-finger pinch alone, so the page can still be zoomed', () => {
      const { page } = renderDialog(500)
      expect(moveCancelled(page, [[90, 90], [210, 210]])).toBe(false)
    })
  })

  it('lets the page scroll again once the last open dialog closes', () => {
    const { page } = renderDialog(500)
    const unlockFirst = lockTouchScroll()
    const unlockSecond = lockTouchScroll()
    unlockFirst()
    expect(swipeCancelled(page)).toBe(true)
    unlockSecond()
    expect(swipeCancelled(page)).toBe(false)
  })
})
