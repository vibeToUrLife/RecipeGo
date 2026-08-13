import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { RoomSubNav } from '@/components/room-subnav'

const nav = vi.hoisted(() => ({ pathname: '/rooms/r1' }))
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }))
vi.mock('@/components/i18n-provider', () => ({ useT: () => (k: string) => k }))

describe('RoomSubNav', () => {
  it('renders the 5 room links with correct hrefs', () => {
    nav.pathname = '/rooms/r1'
    render(<RoomSubNav roomId="r1" />)
    expect(screen.getByText('nav.recipes').closest('a')).toHaveAttribute('href', '/rooms/r1')
    expect(screen.getByText('rooms.members').closest('a')).toHaveAttribute('href', '/rooms/r1/members')
    expect(screen.getByText('nav.ingredients').closest('a')).toHaveAttribute('href', '/rooms/r1/cook')
    expect(screen.getByText('rooms.shoppingList').closest('a')).toHaveAttribute('href', '/rooms/r1/shopping-list')
    expect(screen.getByText('nav.plan').closest('a')).toHaveAttribute('href', '/rooms/r1/plan')
  })

  it('marks the current sub-page active, and not the home link', () => {
    nav.pathname = '/rooms/r1/plan'
    render(<RoomSubNav roomId="r1" />)
    expect(screen.getByText('nav.plan').closest('a')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('nav.recipes').closest('a')).not.toHaveAttribute('aria-current')
    expect(screen.getByText('rooms.members').closest('a')).not.toHaveAttribute('aria-current')
  })

  it('marks the home link active on the room home', () => {
    nav.pathname = '/rooms/r1'
    render(<RoomSubNav roomId="r1" />)
    expect(screen.getByText('nav.recipes').closest('a')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('nav.plan').closest('a')).not.toHaveAttribute('aria-current')
  })
})
