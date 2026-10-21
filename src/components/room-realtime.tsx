'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

// Room-scoped tables that carry a room_id column.
const ROOM_ID_TABLES = [
  'recipes',
  'shopping_list_items',
  'meal_plan_entries',
  'room_members',
  'room_invites',
] as const

// One table to listen to, narrowed by a postgres_changes filter.
type Watch = { table: string; filter: string }

/**
 * Invisible subscriber. While mounted, listens for Postgres changes to the
 * current room's tables and re-pulls the server-rendered page (debounced) so
 * every member sees each other's changes without reloading. RLS on the tables
 * scopes events to room members, so no manual authorization is needed here.
 */
export function RoomRealtime({ roomId }: { roomId: string }) {
  const router = useRouter()

  useEffect(() => {
    if (!roomId) return
    return refreshOnChange(router, `room:${roomId}`, () => [
      ...ROOM_ID_TABLES.map((table) => ({ table, filter: `room_id=eq.${roomId}` })),
      // The room row itself (rename / delete) is keyed by id, not room_id.
      { table: 'rooms', filter: `id=eq.${roomId}` },
    ])
  }, [roomId, router])

  return null
}

/**
 * The same for your own plan, which only you can see: a meal ticked as eaten
 * (or added, moved or changed) on your phone shows on the plan open on your
 * computer, or in another tab, without reloading.
 */
export function PlanRealtime() {
  const router = useRouter()

  useEffect(
    () =>
      refreshOnChange(router, 'plan', (userId) =>
        // Your own meals have no room_id to filter on, so match on whose they
        // are. That takes in the meals you put on a room's plan too; a change to
        // one of those re-pulls this page for nothing, which does no harm.
        userId ? [{ table: 'meal_plan_entries', filter: `user_id=eq.${userId}` }] : [],
      ),
    [router],
  )

  return null
}

// Opens one channel listening for the changes watchesFor names (it's handed the
// signed-in user's id) and re-pulls the page, debounced, on each. Returns the
// cleanup.
function refreshOnChange(
  router: { refresh: () => void },
  name: string,
  watchesFor: (userId: string | undefined) => Watch[],
): () => void {
  const supabase = createClient()
  let cancelled = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let connectedOnce = false
  let channel: ReturnType<typeof supabase.channel> | null = null

  const scheduleRefresh = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => router.refresh(), 300)
  }

  const start = async () => {
    // Realtime must carry the user's JWT so RLS-filtered postgres_changes are
    // delivered to this member. The ssr client hydrates the session async, so we
    // set the token explicitly here to cover the *initial* subscribe.
    //
    // Ongoing refreshes are handled by the SDK — no staleness on token expiry:
    // @supabase/supabase-js 2.108.2 wires auth.onAuthStateChange ->
    // _handleTokenChanged -> realtime.setAuth(newToken) on TOKEN_REFRESHED /
    // SIGNED_IN (SupabaseClient._listenForAuthEvents), which is active because
    // @supabase/ssr's createBrowserClient uses the default auth (no custom
    // accessToken fn). So when the ~1h access token rotates on a long-lived tab,
    // the realtime socket is re-authed automatically; we don't re-setAuth here.
    const { data } = await supabase.auth.getSession()
    if (cancelled) return
    if (data.session) supabase.realtime.setAuth(data.session.access_token)

    const watches = watchesFor(data.session?.user.id)
    if (watches.length === 0) return
    channel = supabase.channel(name)
    for (const { table, filter } of watches) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter },
        scheduleRefresh,
      )
    }

    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED') return
      if (connectedOnce) scheduleRefresh() // reconnect → catch up on missed changes
      else connectedOnce = true // first connect: SSR data is already fresh
    })
  }

  start().catch((err) => console.warn(`Realtime setup failed (${name})`, err))

  return () => {
    cancelled = true
    if (timer) clearTimeout(timer)
    if (channel) supabase.removeChannel(channel)
  }
}
