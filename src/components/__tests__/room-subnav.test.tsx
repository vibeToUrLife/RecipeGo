import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { RoomSubNav } from '@/components/room-subnav'
import { NavLinks } from '@/components/nav-links'

const nav = vi.hoisted(() => ({ pathname: '/rooms/r1' }))
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }))
vi.mock('@/lib/use-current-room-id', () => ({ useCurrentRoomId: () => 'r1' }))
vi.mock('@/components/i18n-provider', () => ({ useT: () => (k: string) => k }))

const links = () => screen.getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])

describe('RoomSubNav', () => {
  it('shows the same links, in the same order, as the header nav', () => {
    nav.pathname = '/rooms/r1'
    const header = render(<NavLinks roomId="r1" />)
    const headerLinks = links()
    header.unmount()
    render(<RoomSubNav roomId="r1" />)
    expect(links()).toEqual(headerLinks)
    expect(links().map(([label]) => label)).toEqual([
      'nav.recipes',
      'nav.plan',
      'nav.ingredients',
      'nav.shoppingList',
      'rooms.members',
    ])
  })

  it('marks the current sub-page active', () => {
    nav.pathname = '/rooms/r1/plan'
    render(<RoomSubNav roomId="r1" />)
    expect(screen.getByText('nav.plan').closest('a')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('nav.recipes').closest('a')).not.toHaveAttribute('aria-current')
  })

  it('hides from lg up, where the header shows these pills itself', () => {
    render(<RoomSubNav roomId="r1" />)
    expect(screen.getByRole('navigation')).toHaveClass('lg:hidden')
  })

  it('stays pinned under the header when the page scrolls', () => {
    render(<RoomSubNav roomId="r1" />)
    expect(screen.getByRole('navigation')).toHaveClass('sticky', 'top-[61px]')
  })

  it("keeps the pills to one line, scrolling sideways where they don't fit", () => {
    render(<RoomSubNav roomId="r1" />)
    expect(screen.getByRole('navigation')).toHaveClass('overflow-x-auto')
    expect(screen.getByRole('navigation')).not.toHaveClass('flex-wrap')
  })

  describe('opening on a page whose pill is off to the side', () => {
    afterEach(() => vi.restoreAllMocks())

    it("brings the current page's pill to the middle of the row", () => {
      nav.pathname = '/rooms/r1/members'
      // jsdom does no layout: a 300px row, with the current pill 400px along it, 80px wide.
      const isCurrent = (el: Element) => el.getAttribute('aria-current') === 'page'
      vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(function (this: Element) {
        return this.tagName === 'NAV' ? 300 : 0
      })
      vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function (this: HTMLElement) {
        return isCurrent(this) ? 400 : 0
      })
      vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
        return isCurrent(this) ? 80 : 0
      })
      const scrolled = vi.spyOn(Element.prototype, 'scrollLeft', 'set')

      render(<RoomSubNav roomId="r1" />)
      expect(scrolled).toHaveBeenCalledWith(400 - (300 - 80) / 2)
    })
  })
})
