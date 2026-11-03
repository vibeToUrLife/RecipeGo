import { describe, it, expect, afterEach } from 'vitest'
import { pinnedHeight } from '@/lib/pinned-height'

// jsdom does no layout, so each element's height is set by hand.
function add(html: string, height: number) {
  document.body.insertAdjacentHTML('beforeend', html)
  Object.defineProperty(document.body.lastElementChild, 'offsetHeight', { value: height })
}

afterEach(() => { document.body.innerHTML = '' })

describe('pinnedHeight', () => {
  it('reaches the bottom of the lowest thing pinned to the top', () => {
    add('<header style="position: sticky; top: 0px"></header>', 61)
    add('<nav style="position: sticky; top: 61px"></nav>', 44)
    expect(pinnedHeight()).toBe(105)
  })

  // From lg up the room's pill row is hidden; it would otherwise claim 61px.
  it("leaves out something pinned that isn't shown", () => {
    add('<header style="position: sticky; top: 0px"></header>', 55)
    add('<nav style="position: sticky; top: 61px"></nav>', 0)
    expect(pinnedHeight()).toBe(55)
  })

  it("leaves out a nav that scrolls with the page", () => {
    add('<header style="position: sticky; top: 0px"></header>', 61)
    add('<nav></nav>', 300)
    expect(pinnedHeight()).toBe(61)
  })
})
