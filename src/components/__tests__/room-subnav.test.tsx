import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
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
})
