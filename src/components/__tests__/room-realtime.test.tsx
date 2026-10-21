import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'
import { RoomRealtime, PlanRealtime } from '@/components/room-realtime'

// --- mocks ---
const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

let channels: string[] = []
let watched: unknown[] = []
let handlers: Array<() => void> = []
let subscribeCb: ((status: string) => void) | undefined
const removeChannel = vi.fn()
const setAuth = vi.fn()
const getSession = vi.fn()

const channel = {
  on(_event: string, config: unknown, cb: () => void) {
    watched.push(config)
    handlers.push(cb)
    return this
  },
  subscribe(cb: (status: string) => void) {
    subscribeCb = cb
    cb('SUBSCRIBED')
    return this
  },
}

vi.mock('@/utils/supabase/client', () => ({
  createClient: () => ({
    channel: (name: string) => {
      channels.push(name)
      return channel
    },
    removeChannel,
    auth: { getSession },
    realtime: { setAuth },
  }),
}))

beforeEach(() => {
  channels = []
  watched = []
  handlers = []
  subscribeCb = undefined
  refresh.mockClear()
  removeChannel.mockClear()
  setAuth.mockClear()
  getSession.mockReset()
  getSession.mockResolvedValue({ data: { session: { access_token: 'tok', user: { id: 'user-1' } } } })
})

describe('RoomRealtime', () => {
  it('sets the realtime auth token and registers change handlers', async () => {
    render(<RoomRealtime roomId="room-1" />)
    await waitFor(() => expect(handlers.length).toBeGreaterThan(0))
    expect(setAuth).toHaveBeenCalledWith('tok')
  })

  it("listens to every room table, the plan's included, narrowed to this room", async () => {
    render(<RoomRealtime roomId="room-1" />)
    await waitFor(() => expect(handlers.length).toBeGreaterThan(0))
    expect(channels).toEqual(['room:room-1'])
    const change = (table: string, filter: string) => ({ event: '*', schema: 'public', table, filter })
    expect(watched).toEqual([
      change('recipes', 'room_id=eq.room-1'),
      change('shopping_list_items', 'room_id=eq.room-1'),
      change('meal_plan_entries', 'room_id=eq.room-1'),
      change('room_members', 'room_id=eq.room-1'),
      change('room_invites', 'room_id=eq.room-1'),
      change('rooms', 'id=eq.room-1'),
    ])
  })

  it('debounces a burst of changes into a single refresh', async () => {
    render(<RoomRealtime roomId="room-1" />)
    await waitFor(() => expect(handlers.length).toBeGreaterThan(0))

    vi.useFakeTimers()
    handlers[0]()
    handlers[0]() // second change inside the debounce window
    expect(refresh).not.toHaveBeenCalled()
    vi.advanceTimersByTime(300)
    expect(refresh).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('refreshes once after a reconnect (a later SUBSCRIBED)', async () => {
    render(<RoomRealtime roomId="room-1" />)
    await waitFor(() => expect(subscribeCb).toBeDefined())

    vi.useFakeTimers()
    // first SUBSCRIBED already fired on mount → must NOT refresh
    subscribeCb!('SUBSCRIBED') // simulate reconnect
    vi.advanceTimersByTime(300)
    expect(refresh).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('removes the channel on unmount', async () => {
    const { unmount } = render(<RoomRealtime roomId="room-1" />)
    await waitFor(() => expect(handlers.length).toBeGreaterThan(0))
    unmount()
    expect(removeChannel).toHaveBeenCalledWith(channel)
  })
})

describe('PlanRealtime', () => {
  it("listens to the signed-in user's own planned meals", async () => {
    render(<PlanRealtime />)
    await waitFor(() => expect(handlers.length).toBeGreaterThan(0))
    expect(setAuth).toHaveBeenCalledWith('tok')
    expect(watched).toEqual([
      { event: '*', schema: 'public', table: 'meal_plan_entries', filter: 'user_id=eq.user-1' },
    ])
  })

  it('re-pulls the plan once for a burst of changes, such as a meal ticked as eaten elsewhere', async () => {
    render(<PlanRealtime />)
    await waitFor(() => expect(handlers.length).toBeGreaterThan(0))

    vi.useFakeTimers()
    handlers[0]()
    handlers[0]()
    expect(refresh).not.toHaveBeenCalled()
    vi.advanceTimersByTime(300)
    expect(refresh).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('opens no channel when no one is signed in', async () => {
    getSession.mockResolvedValue({ data: { session: null } })
    render(<PlanRealtime />)
    await waitFor(() => expect(getSession).toHaveBeenCalled())
    await act(async () => {}) // let the subscribe step that follows the session run
    expect(channels).toEqual([])
  })

  it('removes the channel on unmount', async () => {
    const { unmount } = render(<PlanRealtime />)
    await waitFor(() => expect(handlers.length).toBeGreaterThan(0))
    unmount()
    expect(removeChannel).toHaveBeenCalledWith(channel)
  })
})
