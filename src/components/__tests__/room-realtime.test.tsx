import { render, waitFor } from '@testing-library/react'
import { RoomRealtime } from '@/components/room-realtime'

// --- mocks ---
const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

let handlers: Array<() => void> = []
let subscribeCb: ((status: string) => void) | undefined
const removeChannel = vi.fn()
const setAuth = vi.fn()
const getSession = vi.fn()

const channel = {
  on(_event: string, _config: unknown, cb: () => void) {
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
    channel: () => channel,
    removeChannel,
    auth: { getSession },
    realtime: { setAuth },
  }),
}))

beforeEach(() => {
  handlers = []
  subscribeCb = undefined
  refresh.mockClear()
  removeChannel.mockClear()
  setAuth.mockClear()
  getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } })
})

describe('RoomRealtime', () => {
  it('sets the realtime auth token and registers change handlers', async () => {
    render(<RoomRealtime roomId="room-1" />)
    await waitFor(() => expect(handlers.length).toBeGreaterThan(0))
    expect(setAuth).toHaveBeenCalledWith('tok')
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
