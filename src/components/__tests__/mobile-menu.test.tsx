import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import type { Room } from '@/lib/db-types'
import { MobileMenu } from '@/components/mobile-menu'

const nav = vi.hoisted(() => ({ roomId: 'r1' as string | null }))
vi.mock('@/lib/use-current-room-id', () => ({ useCurrentRoomId: () => nav.roomId }))
vi.mock('@/components/i18n-provider', () => ({ useT: () => (k: string) => k }))

const rooms = [{ id: 'r1', name: 'Southbay Kitchen' }] as Room[]

describe('MobileMenu page options', () => {
  it('prefixes each page option with the room name when in a room', () => {
    nav.roomId = 'r1'
    render(<MobileMenu rooms={rooms} signOut={() => {}} />)
    fireEvent.click(screen.getByRole('button')) // open the hamburger
    expect(screen.getByText('Southbay Kitchen – nav.recipes')).toBeInTheDocument()
    expect(screen.getByText('Southbay Kitchen – nav.plan')).toBeInTheDocument()
    expect(screen.getByText('Southbay Kitchen – nav.ingredients')).toBeInTheDocument()
    expect(screen.getByText('Southbay Kitchen – nav.shoppingList')).toBeInTheDocument()
  })

  it('prefixes with the personal label when not in a room', () => {
    nav.roomId = null
    render(<MobileMenu rooms={rooms} signOut={() => {}} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('nav.myRecipes – nav.plan')).toBeInTheDocument()
  })

  it('highlights the current room in the switcher list', () => {
    nav.roomId = 'r1'
    render(<MobileMenu rooms={rooms} signOut={() => {}} />)
    fireEvent.click(screen.getByRole('button'))
    // Exact text "Southbay Kitchen" (no "– section") = the switcher entry.
    expect(screen.getByText('Southbay Kitchen').className).toContain('text-primary')
    // The personal entry is not highlighted while in a room.
    expect(screen.getByText('nav.myRecipes').className).not.toContain('text-primary')
  })

  it('highlights My Recipes when not in a room', () => {
    nav.roomId = null
    render(<MobileMenu rooms={rooms} signOut={() => {}} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('nav.myRecipes').className).toContain('text-primary')
    expect(screen.getByText('Southbay Kitchen').className).not.toContain('text-primary')
  })

  it('uses the explicit roomId prop over the URL (e.g. a recipe detail page)', () => {
    // No room in the URL — but the recipe's page tells us which room it's in.
    nav.roomId = null
    render(<MobileMenu rooms={rooms} signOut={() => {}} roomId="r1" />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('Southbay Kitchen – nav.recipes')).toBeInTheDocument()
    expect(screen.getByText('Southbay Kitchen').className).toContain('text-primary')
  })
})
