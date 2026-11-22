import { describe, expect, it } from 'vitest'
import { edgeScroll } from '@/lib/use-touch-drag'

// The page scrolls under a finger carrying something only near the top (below
// what's pinned there, here 100px) and the bottom (here 800px) of the screen.
describe('edgeScroll', () => {
  it('leaves the page alone with the finger well inside the screen', () => {
    expect(edgeScroll(400, 100, 800)).toBe(0)
    expect(edgeScroll(100 + 72, 100, 800)).toBe(0)
    expect(edgeScroll(800 - 72, 100, 800)).toBe(0)
  })

  it('scrolls up near the top, faster the nearer it gets, and fastest over what’s pinned there', () => {
    const slow = edgeScroll(160, 100, 800)
    const fast = edgeScroll(110, 100, 800)
    expect(slow).toBeLessThan(0)
    expect(fast).toBeLessThan(slow)
    expect(edgeScroll(40, 100, 800)).toBe(-18)
  })

  it('scrolls down near the bottom the same way, no faster than at the very edge', () => {
    const slow = edgeScroll(740, 100, 800)
    const fast = edgeScroll(795, 100, 800)
    expect(slow).toBeGreaterThan(0)
    expect(fast).toBeGreaterThan(slow)
    expect(edgeScroll(800, 100, 800)).toBe(18)
    expect(edgeScroll(900, 100, 800)).toBe(18)
  })
})
