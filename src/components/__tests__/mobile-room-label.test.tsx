import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import type { Room } from '@/lib/db-types'
import { MobileRoomLabel } from '@/components/mobile-room-label'

const nav = vi.hoisted(() => ({ pathname: '/rooms/r1', roomId: null as string | null }))
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }))
vi.mock('@/lib/use-current-room-id', () => ({ useCurrentRoomId: () => nav.roomId }))
vi.mock('@/components/i18n-provider', () => ({ useT: () => (k: string) => k }))

const rooms = [{ id: 'r1', name: 'Southbay Kitchen' }] as Room[]

describe('MobileRoomLabel', () => {
  it('shows "room name – Recipes" on the room library page', () => {
    nav.pathname = '/rooms/r1'
    nav.roomId = 'r1'
    render(<MobileRoomLabel rooms={rooms} />)
    expect(screen.getByText('Southbay Kitchen – nav.recipes')).toBeInTheDocument()
  })

  it('updates the section as you navigate within the room', () => {
    nav.pathname = '/rooms/r1/shopping-list'
    nav.roomId = 'r1'
    render(<MobileRoomLabel rooms={rooms} />)
    expect(screen.getByText('Southbay Kitchen – rooms.shoppingList')).toBeInTheDocument()
  })

  it('shows just the personal label on the personal home', () => {
    nav.pathname = '/'
    nav.roomId = null
    render(<MobileRoomLabel rooms={rooms} />)
    expect(screen.getByText('nav.myRecipes')).toBeInTheDocument()
  })

  it('appends the section on a personal sub-page', () => {
    nav.pathname = '/plan'
    nav.roomId = null
    render(<MobileRoomLabel rooms={rooms} />)
    expect(screen.getByText('nav.myRecipes – nav.plan')).toBeInTheDocument()
  })

  it('prefers an explicit roomId prop over the URL', () => {
    nav.pathname = '/recipes/xyz' // a room recipe's detail page
    nav.roomId = null
    render(<MobileRoomLabel rooms={rooms} roomId="r1" />)
    expect(screen.getByText('Southbay Kitchen – nav.recipes')).toBeInTheDocument()
  })
})
