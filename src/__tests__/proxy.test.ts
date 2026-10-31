import { describe, it, expect, vi } from 'vitest'
import { config } from '@/proxy'

vi.mock('@/utils/supabase/middleware', () => ({ updateSession: vi.fn() }))

// Next runs the proxy, which sends anyone signed out to /login, on the paths
// its matcher matches.
const checked = (path: string) => config.matcher.some((m) => new RegExp(`^${m}$`).test(path))

describe('proxy matcher', () => {
  it('checks the login on pages', () => {
    expect(checked('/plan')).toBe(true)
    expect(checked('/rooms/r1/plan')).toBe(true)
  })

  // A phone fetches these without your login when RecipeGo is added to its home
  // screen; sent to /login instead, it would add a plain bookmark.
  it('serves the manifest and icons without a login check', () => {
    expect(checked('/manifest.webmanifest')).toBe(false)
    expect(checked('/apple-icon.png')).toBe(false)
    expect(checked('/icon-192.png')).toBe(false)
    expect(checked('/icon-maskable-512.png')).toBe(false)
  })
})
