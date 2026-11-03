// How far down the screen what's pinned to its top reaches: the header, and on
// a room's page below lg the pill row pinned under it. What sits just below
// them — a card scrolled to, the recipe search pinned there — starts here.
// Something pinned but not shown (the pill row from lg up) doesn't count.
export function pinnedHeight(): number {
  let bottom = 0
  for (const el of document.querySelectorAll<HTMLElement>('header, nav')) {
    if (el.offsetHeight === 0) continue
    const { position, top } = getComputedStyle(el)
    if (position === 'sticky' || position === 'fixed') {
      bottom = Math.max(bottom, (parseFloat(top) || 0) + el.offsetHeight)
    }
  }
  return bottom
}
