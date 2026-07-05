# Live sync in Shared Rooms — Design

**Date:** 2026-07-04
**Status:** Approved, ready for implementation planning
**Author:** Claude + owner

## Goal

When two or more members are viewing the same room, any change one member makes
appears for the others **within about a second, without a page reload** — across
**every** page inside a room:

- Recipe library — `/rooms/[roomId]`
- Shopping list — `/rooms/[roomId]/shopping-list`
- Members & invites — `/rooms/[roomId]/members`
- Spin wheel — `/rooms/[roomId]/spin`
- Ingredient checklist — `/rooms/[roomId]/cook`
- Weekly meal plan — `/rooms/[roomId]/plan`

Out of scope (owner's choice): presence / "who is online" indicators, live cursors,
and personal (non-room) pages — those are single-user and need no sync.

## Background — how rooms work today

RecipeGo is Next.js 16 + React 19 + Supabase.

- **Every room page is an async Server Component.** It fetches on the server via
  `src/lib/data/*` (`getRoom`, `listRecipes`, `getShoppingList`, `listMembers`, …)
  and passes the data as props to `'use client'` child components
  (`RecipeLibrary`, `ShoppingListView`, `MemberRow`, `SpinWheel`, …).
- **After a mutation, the client calls `router.refresh()`** (see `member-row.tsx`,
  `invite-actions.tsx`, `planned-meal.tsx`, …). `router.refresh()` re-runs the
  server components and streams fresh data down while preserving client state.
- **The gap:** mutations call `revalidatePath(...)`, which only invalidates the
  *acting user's own* Next.js cache. It does **not** notify other members. So today
  a second member sees stale data until they manually reload.
- **Supabase Realtime is not enabled.** No table is in the `supabase_realtime`
  publication and none has `REPLICA IDENTITY FULL`. `config.toml` has
  `[realtime] enabled = true`, which only starts the local Realtime service.

### Data model (relevant tables)

Room-scoped content carries a nullable `room_id` (NULL = personal, set = shared):

- `recipes` — `room_id` FK → `rooms(id)`
- `shopping_list_items` — `room_id` FK
- `meal_plan_entries` — `room_id` FK
- `ingredients`, `steps` — **no** `room_id`; scoped indirectly through their parent
  recipe. **Editing a recipe always bumps `recipes.updated_at`**, so an ingredient
  or step change still produces a `recipes` UPDATE event — we do **not** need to
  publish these child tables.

Membership tables:

- `rooms` — `id`, `owner_id`, `name`
- `room_members` — composite PK `(room_id, user_id)`, `role`
- `room_invites` — `id`, `room_id`, `email`, `status`

**RLS is member-scoped** everywhere (`is_room_member`, `is_room_owner`,
`can_access_recipe`). Supabase Realtime `postgres_changes` **respects RLS**, so once
tables are published, a member only ever receives events for rooms they belong to —
secure by construction, no extra filtering logic needed for isolation.

## Approach — "refresh on change"

```
Member B checks an item  ─▶  Postgres UPDATE  ─▶  Supabase Realtime
                                                        │ (delivered only to room members — RLS)
Member A's open room page  ◀── router.refresh() ◀───────┘
   └─▶ server re-fetches, new state appears  (~1s, no reload)
```

A tiny invisible client component subscribes to Postgres changes on the room's
tables and calls `router.refresh()` when a change arrives.

### Why `router.refresh()` and not client-side row patching

1. **Matches the codebase** — the app already uses `router.refresh()` after every
   mutation; the server component stays the single source of truth.
2. **Correct for the shopping list** — `addRecipeToList` and `completeShopping`
   **delete then re-insert** rows. A per-row browser diff would flicker or drop
   state; a full refresh always shows the correct final list.
3. **Least code** — no duplicated rendering/merge logic in the browser.

Trade-off: each remote change costs one lightweight server round-trip (the RSC
payload) instead of an in-place DOM patch. For a small shared-kitchen app with a
handful of members this is negligible, and debouncing collapses bursts.

## Components to build

### 1. Database migration — enable Realtime on room tables

New file: `supabase/migrations/<timestamp>_realtime_rooms.sql`. Idempotent so it is
safe to re-run and safe on a fresh local DB.

Publish these six tables and set `REPLICA IDENTITY FULL` on each:
`recipes`, `shopping_list_items`, `meal_plan_entries`, `room_members`,
`room_invites`, `rooms`.

`REPLICA IDENTITY FULL` is required so that **UPDATE and DELETE** events carry the
old row's columns — without it a delete would not include `room_id`, and the
client-side `room_id=eq.…` filter could not match it, so deletes would be missed.

```sql
-- Ensure the publication exists (Supabase ships it by default; guard for fresh local DBs)
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- Add each room table to the realtime publication (idempotent) + full replica identity
do $$
declare
  t text;
  room_tables text[] := array[
    'recipes', 'shopping_list_items', 'meal_plan_entries',
    'room_members', 'room_invites', 'rooms'
  ];
begin
  foreach t in array room_tables loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
    execute format('alter table public.%I replica identity full', t);
  end loop;
end $$;
```

### 2. Reusable subscriber — `src/components/room-realtime.tsx`

A `'use client'` component that renders `null`. Responsibilities:

- Open **one** Realtime channel per room: `supabase.channel('room:' + roomId)`.
- Add a `postgres_changes` listener per table:
  - `recipes`, `shopping_list_items`, `meal_plan_entries`, `room_members`,
    `room_invites` → filter `room_id=eq.{roomId}`.
  - `rooms` → filter `id=eq.{roomId}` (rename / delete of the room itself).
- On any event, call a **debounced** `router.refresh()` (~300 ms) so the shopping
  list's delete+reinsert burst triggers a single refresh, not many.
- **Reconnect catch-up:** on the *first* `SUBSCRIBED` do nothing (SSR data is
  already fresh); on a *subsequent* `SUBSCRIBED` (i.e. after a dropped connection)
  refresh once to pick up anything missed while offline.
- Clean up on unmount / `roomId` change: clear the timer and
  `supabase.removeChannel(channel)`.

Reference shape (final code must be verified against the installed Next 16 and
supabase-js APIs — see Implementation notes):

```tsx
'use client'
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

const ROOM_ID_TABLES = [
  'recipes',
  'shopping_list_items',
  'meal_plan_entries',
  'room_members',
  'room_invites',
] as const

export function RoomRealtime({ roomId }: { roomId: string }) {
  const router = useRouter()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const connectedOnce = useRef(false)

  useEffect(() => {
    if (!roomId) return
    const supabase = createClient()

    const scheduleRefresh = () => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => router.refresh(), 300)
    }

    const channel = supabase.channel(`room:${roomId}`)
    for (const table of ROOM_ID_TABLES) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `room_id=eq.${roomId}` },
        scheduleRefresh,
      )
    }
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
      scheduleRefresh,
    )

    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED') return
      if (connectedOnce.current) scheduleRefresh() // reconnect → catch up
      else connectedOnce.current = true
    })

    return () => {
      if (timer.current) clearTimeout(timer.current)
      supabase.removeChannel(channel)
    }
  }, [roomId, router])

  return null
}
```

### 3. New room layout — `src/app/rooms/[roomId]/layout.tsx`

There is currently no layout under `rooms/[roomId]`. Add one so the subscriber
mounts once and covers **all six** room pages (and any future room page). Because a
layout persists across navigation between its child segments, the channel stays open
as the user moves library → shopping list → members within the same room (no
reconnect churn), and `router.refresh()` refreshes whichever room sub-page is active.

```tsx
import { RoomRealtime } from '@/components/room-realtime'

export default async function RoomLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ roomId: string }>
}) {
  const { roomId } = await params
  return (
    <>
      <RoomRealtime roomId={roomId} />
      {children}
    </>
  )
}
```

## Data flow (worked example — shopping list)

1. Member B taps a checkbox → `toggleItemAction` → `UPDATE shopping_list_items`.
2. Postgres emits the change to the `supabase_realtime` publication.
3. Realtime evaluates RLS with each subscriber's JWT and delivers the event only to
   members of that room.
4. Member A's `RoomRealtime` (mounted by the room layout) receives it and schedules a
   debounced `router.refresh()`.
5. A's `RoomShoppingListPage` server component re-runs `getShoppingList(roomId)`; the
   updated checkbox renders. No reload.

## Edge cases & decisions

- **Bursts (delete + reinsert):** collapsed into one refresh by the 300 ms debounce.
- **Deletes:** delivered and matched thanks to `REPLICA IDENTITY FULL`.
- **Reconnect:** refresh once on re-subscribe, not on the first subscribe.
- **Self-events:** your own change also triggers a refresh. Harmless and idempotent;
  we deliberately do **not** try to suppress it (keeps the code simple — the acting
  user already refreshes anyway).
- **Edit forms are not disrupted:** the recipe editor lives at `/recipes/[id]/edit`
  (under `/recipes`, not `/rooms`), so it is **not** wrapped by the room layout and a
  member typing in the form is never interrupted by a remote refresh.
- **Recipe create/update revalidation gap (pre-existing):** `createRecipe` revalidates
  only `/`, `updateRecipe` only `/recipes/{id}` — neither refreshes the room list.
  Realtime makes this moot for *other* members (they get a `recipes` event), and the
  acting user gets a fresh room page from the subscriber on return. No change required,
  but noted.
- **Recipe moved *out* of a room is not pushed to the old room's members:** `updateRecipe` can change `room_id`. On that UPDATE, the change event matches the *new* record's `room_id`, so members still viewing the *old* room won't receive it and keep seeing the moved recipe until they navigate away. Moving a recipe *into* a room syncs correctly. Acceptable; the mover and the new room update fine.
- **A removed member does not receive their own removal event:** the `room_members` DELETE is RLS-evaluated as the now-non-member, so they don't get the event and their stale room view persists until they navigate. Their subsequent server actions fail RLS anyway (no data leak). Consistent with presence being out of scope.

## Security

No new attack surface. Realtime `postgres_changes` enforces the existing RLS policies
using the subscriber's JWT, so a user receives change events only for rooms they are a
member of — the same boundary already proven by `supabase/tests/rooms_rls.test.sql`.
The browser client is the anon key + user session (never the service-role key).

## Testing

1. **pgTAP** — new `supabase/tests/realtime_publication.test.sql` asserting that each
   of the six tables is present in `pg_publication_tables` for `supabase_realtime` and
   that `pg_class.relreplident = 'f'` (full) for each. Runs via `supabase test db`.
2. **RLS isolation check** — assert (manually or via test) that a non-member's
   authenticated client receives **no** events for a room's changes.
3. **Two-browser smoke test** — documented in the README: open the same room in two
   browsers signed in as two members; change something in one (check an item, add a
   recipe, rename the room, invite/accept a member) and confirm the other updates
   within ~1s without reloading.

## Implementation notes (read before coding)

- **AGENTS.md:** "This is NOT the Next.js you know." Before writing the layout and the
  client component, read the relevant guide under `node_modules/next/dist/docs/` and
  confirm the Next 16 `layout` params shape and `router.refresh()` semantics.
- **Realtime + RLS auth gotcha:** for RLS-filtered `postgres_changes` the Realtime
  connection must carry the user's JWT. `createBrowserClient` (@supabase/ssr) hydrates
  the session from cookies, but verify the token reaches Realtime **before** subscribe
  — if events don't arrive, set it explicitly (e.g. read `getSession()` and call
  `supabase.realtime.setAuth(token)` prior to `channel.subscribe()`). The RLS isolation
  test above is what proves this is wired correctly.
- **Supabase free tier:** Realtime allows ~200 concurrent connections and ~2M
  messages/month — far above this app's needs (one channel per open room tab).
```
