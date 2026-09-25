import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { NavLinks } from '@/components/nav-links'

const nav = vi.hoisted(() => ({ pathname: '/', roomId: null as string | null }))
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }))
vi.mock('@/lib/use-current-room-id', () => ({ useCurrentRoomId: () => nav.roomId }))
vi.mock('@/components/i18n-provider', () => ({ useT: () => (k: string) => k }))

const link = (label: string) => screen.getByText(label).closest('a')

describe('NavLinks', () => {
  it('points at the personal pages outside a room', () => {
    nav.pathname = '/'
    nav.roomId = null
    render(<NavLinks />)
    expect(link('nav.recipes')).toHaveAttribute('href', '/')
    expect(link('nav.plan')).toHaveAttribute('href', '/plan')
    expect(link('nav.ingredients')).toHaveAttribute('href', '/cook')
    expect(link('nav.shoppingList')).toHaveAttribute('href', '/shopping-list')
  })

  it('points at the room pages inside a room', () => {
    nav.pathname = '/rooms/r1'
    nav.roomId = 'r1'
    render(<NavLinks />)
    expect(link('nav.recipes')).toHaveAttribute('href', '/rooms/r1')
    expect(link('nav.plan')).toHaveAttribute('href', '/rooms/r1/plan')
    expect(link('nav.ingredients')).toHaveAttribute('href', '/rooms/r1/cook')
    expect(link('nav.shoppingList')).toHaveAttribute('href', '/rooms/r1/shopping-list')
  })

  it('renders the same green pills as the room sub-nav', () => {
    nav.pathname = '/'
    nav.roomId = null
    render(<NavLinks />)
    for (const label of ['nav.recipes', 'nav.plan', 'nav.ingredients', 'nav.shoppingList']) {
      expect(link(label)).toHaveClass('bg-secondary')
    }
  })

  it('marks the current page active', () => {
    nav.pathname = '/rooms/r1/cook'
    nav.roomId = 'r1'
    render(<NavLinks />)
    expect(link('nav.ingredients')).toHaveAttribute('aria-current', 'page')
    // Recipes is the room's home link — a sub-page doesn't make it active.
    expect(link('nav.recipes')).not.toHaveAttribute('aria-current')
    expect(link('nav.plan')).not.toHaveAttribute('aria-current')
  })

  it('marks Recipes active on the personal home', () => {
    nav.pathname = '/'
    nav.roomId = null
    render(<NavLinks />)
    expect(link('nav.recipes')).toHaveAttribute('aria-current', 'page')
    expect(link('nav.shoppingList')).not.toHaveAttribute('aria-current')
  })

  it('uses the explicit roomId prop over the URL (e.g. a recipe detail page)', () => {
    nav.pathname = '/recipes/abc'
    nav.roomId = null
    render(<NavLinks roomId="r1" />)
    expect(link('nav.recipes')).toHaveAttribute('href', '/rooms/r1')
    // A recipe page isn't one of the nav's pages, so nothing is marked current.
    expect(document.querySelector('[aria-current]')).toBeNull()
  })
})
