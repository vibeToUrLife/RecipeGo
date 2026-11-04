// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ROOM = '22222222-2222-4222-8222-222222222222'
const state: {
  user: { id: string } | null
  member: boolean
  refresh: boolean
  asked: { table: string; filters: Record<string, unknown> }[]
} = { user: null, member: false, refresh: false, asked: [] }

// Supabase as the proxy sees it: who's signed in (refreshing their session if
// told to), and whether they're in a room.
vi.mock('@supabase/ssr', () => ({
  createServerClient: (_url: string, _key: string, { cookies }: { cookies: { setAll: (c: unknown[]) => void } }) => ({
    auth: {
      getUser: async () => {
        if (state.refresh) cookies.setAll([{ name: 'sb-db-auth-token', value: 'refreshed', options: { path: '/' } }])
        return { data: { user: state.user } }
      },
    },
    from: (table: string) => {
      const filters: Record<string, unknown> = {}
      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => ((filters[column] = value), query),
        maybeSingle: async () => {
          state.asked.push({ table, filters })
          return { data: state.member ? { room_id: filters.room_id } : null, error: null }
        },
      }
      return query
    },
  }),
}))

import { updateSession } from '@/utils/supabase/middleware'

const visit = (path: string, cookie = `last_collection=${ROOM}`) =>
  updateSession(new NextRequest(`http://localhost${path}`, { headers: { cookie } }))

beforeEach(() => {
  state.user = { id: 'u1' }
  state.member = true
  state.refresh = false
  state.asked = []
})

describe('opening "/" in the room used last', () => {
  it('sends a fresh visit straight there, before any of the page is sent', async () => {
    const res = await visit('/')
    expect(res.status).toBe(307)
    expect(new URL(res.headers.get('location')!).pathname).toBe(`/rooms/${ROOM}`)
    expect(state.asked).toEqual([{ table: 'room_members', filters: { room_id: ROOM, user_id: 'u1' } }])
  })

  it('takes a session refreshed on the way along with it', async () => {
    state.refresh = true
    const res = await visit('/')
    expect(res.status).toBe(307)
    expect(res.cookies.get('sb-db-auth-token')?.value).toBe('refreshed')
  })

  it('stays on "/" when asked for your own recipes, or with no room remembered', async () => {
    for (const [path, cookie] of [['/?home=1', `last_collection=${ROOM}`], ['/', 'last_collection=personal'], ['/', '']]) {
      const res = await visit(path, cookie)
      expect(res.headers.get('location')).toBeNull()
    }
    expect(state.asked).toHaveLength(0)
  })

  it('stays on "/" when no longer in that room', async () => {
    state.member = false
    expect((await visit('/')).headers.get('location')).toBeNull()
  })

  it('doesn’t ask the database about a cookie that isn’t a room’s id', async () => {
    expect((await visit('/', 'last_collection=../../etc')).headers.get('location')).toBeNull()
    expect(state.asked).toHaveLength(0)
  })

  it('leaves every other page alone', async () => {
    expect((await visit('/plan')).headers.get('location')).toBeNull()
    expect(state.asked).toHaveLength(0)
  })

  it('still sends someone signed out to the login page', async () => {
    state.user = null
    const res = await visit('/')
    expect(new URL(res.headers.get('location')!).pathname).toBe('/login')
  })
})
