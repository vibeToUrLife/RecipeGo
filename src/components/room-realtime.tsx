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
      // delivered to this member. The ssr client hydrates the session async.
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      if (data.session) supabase.realtime.setAuth(data.session.access_token)

      channel = supabase.channel(`room:${roomId}`)
      for (const table of ROOM_ID_TABLES) {
        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table, filter: `room_id=eq.${roomId}` },
          scheduleRefresh,
        )
      }
      // The room row itself (rename / delete) is keyed by id, not room_id.
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        scheduleRefresh,
      )

      channel.subscribe((status) => {
        if (status !== 'SUBSCRIBED') return
        if (connectedOnce) scheduleRefresh() // reconnect → catch up on missed changes
        else connectedOnce = true // first connect: SSR data is already fresh
      })
    }

    void start()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      if (channel) supabase.removeChannel(channel)
    }
  }, [roomId, router])

  return null
}
