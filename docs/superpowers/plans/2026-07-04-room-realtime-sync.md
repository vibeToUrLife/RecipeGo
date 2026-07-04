# Live Sync in Shared Rooms — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When any member changes something in a room, every other member viewing that room sees the change within ~1 second, with no page reload, across all six room pages.

**Architecture:** Enable Supabase Realtime (`postgres_changes`) on the room-scoped tables, then mount one small `'use client'` subscriber (via a new `rooms/[roomId]` layout) that calls `router.refresh()` — debounced — whenever a change arrives. Server components re-fetch and re-render; they stay the single source of truth. RLS already scopes events to room members, so isolation is automatic.

**Tech Stack:** Next.js 16.2.9 (App Router, React 19), Supabase (`@supabase/ssr` browser client + `@supabase/supabase-js` Realtime), Postgres/pgTAP, Vitest + Testing Library (jsdom).

## Global Constraints

- **"This is NOT the Next.js you know."** Next.js 16.2.9. Per `AGENTS.md`, before writing the layout (Task 3) and the client component (Task 2), read the relevant guide under `node_modules/next/dist/docs/` and confirm the Next 16 `layout` params shape (`params` is a `Promise`) and `router.refresh()` semantics. Heed deprecation notices.
- **Browser Supabase client** is `createClient()` from `@/utils/supabase/client` (anon key + user session from cookies). It is Realtime-capable. **Never** use the service-role/admin client in the browser.
- **Client freshness pattern** already used across the app: `import { useRouter } from 'next/navigation'` then `router.refresh()` (see `src/components/member-row.tsx:44`).
- **Vitest tests** live under `src/**/*.{test,spec}.{ts,tsx}`. Environment is `jsdom` with `globals: true` (so `describe`/`it`/`expect`/`vi`/`beforeEach` are global — no import needed) and `@testing-library/jest-dom` matchers loaded via `vitest.setup.ts`. Run a single file with `npx vitest run <path>`; the whole suite with `npm run test:run`.
- **DB tests** run with `npm run test:db` (`supabase test db`) and require Docker / local Supabase. Per the existing `supabase/tests/rooms_rls.test.sql` header, this is **deferred to the project owner** — write the test test-first, but the fail→pass run may be verified by the owner.
- **Migration filenames** are `YYYYMMDDHHMMSS_name.sql` and must sort **after** the latest existing migration `20260630190000_meal_plan.sql`. This plan uses `20260704120000_realtime_rooms.sql`.
- **Commit messages** end with the trailer:
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  ```
- Work happens on branch `feat/room-realtime-sync` (already created).

## File Structure

| File | New/Modified | Responsibility |
| --- | --- | --- |
| `supabase/migrations/20260704120000_realtime_rooms.sql` | Create | Publish the 6 room tables to `supabase_realtime` + set `replica identity full`. |
| `supabase/setup_all.sql` | Modify (append) | Keep the paste-once aggregate schema in sync with the new migration. |
| `supabase/tests/realtime_publication.test.sql` | Create | pgTAP: assert the 6 tables are published and have full replica identity. |
| `src/components/room-realtime.tsx` | Create | The `'use client'` subscriber: one channel per room → debounced `router.refresh()`. |
| `src/components/__tests__/room-realtime.test.tsx` | Create | Unit tests for the subscriber (debounce, reconnect, cleanup, auth). |
| `src/app/rooms/[roomId]/layout.tsx` | Create | Mount `<RoomRealtime>` once so all 6 room pages get live sync. |
| `src/app/rooms/[roomId]/__tests__/layout.test.tsx` | Create | Test the layout passes `roomId` through and renders children. |
| `README.md` | Modify | Add a two-browser realtime smoke-test item + note the new migration. |

---

### Task 1: Enable Realtime on the room tables (DB)

**Files:**
- Create: `supabase/migrations/20260704120000_realtime_rooms.sql`
- Modify: `supabase/setup_all.sql` (append a new section at the end)
- Test: `supabase/tests/realtime_publication.test.sql`

**Interfaces:**
- Consumes: existing tables `recipes`, `shopping_list_items`, `meal_plan_entries`, `room_members`, `room_invites`, `rooms` (all already have RLS).
- Produces: those 6 tables are members of the `supabase_realtime` publication and have `REPLICA IDENTITY FULL`. Task 2's subscriber depends on this to receive events (and on FULL identity so `DELETE`/`UPDATE` events still carry `room_id` for the `room_id=eq.…` filter).

- [ ] **Step 1: Write the failing DB test**

Create `supabase/tests/realtime_publication.test.sql`:

```sql
-- supabase/tests/realtime_publication.test.sql
-- pgTAP: the six room tables are published for Realtime with full replica identity.
--
-- Run with:  supabase test db
-- (requires Docker / local Supabase — deferred to project owner, per rooms_rls.test.sql)

begin;
select plan(12);

-- 1..6: each table is a member of the supabase_realtime publication
select ok(
  exists(
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'recipes'
  ),
  'recipes is published to supabase_realtime'
);
select ok(
  exists(
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shopping_list_items'
  ),
  'shopping_list_items is published to supabase_realtime'
);
select ok(
  exists(
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'meal_plan_entries'
  ),
  'meal_plan_entries is published to supabase_realtime'
);
select ok(
  exists(
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room_members'
  ),
  'room_members is published to supabase_realtime'
);
select ok(
  exists(
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room_invites'
  ),
  'room_invites is published to supabase_realtime'
);
select ok(
  exists(
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rooms'
  ),
  'rooms is published to supabase_realtime'
);

-- 7..12: each table has REPLICA IDENTITY FULL (pg_class.relreplident = 'f')
select is( (select relreplident::text from pg_class where oid = 'public.recipes'::regclass),             'f', 'recipes has replica identity full' );
select is( (select relreplident::text from pg_class where oid = 'public.shopping_list_items'::regclass), 'f', 'shopping_list_items has replica identity full' );
select is( (select relreplident::text from pg_class where oid = 'public.meal_plan_entries'::regclass),   'f', 'meal_plan_entries has replica identity full' );
select is( (select relreplident::text from pg_class where oid = 'public.room_members'::regclass),        'f', 'room_members has replica identity full' );
select is( (select relreplident::text from pg_class where oid = 'public.room_invites'::regclass),        'f', 'room_invites has replica identity full' );
select is( (select relreplident::text from pg_class where oid = 'public.rooms'::regclass),               'f', 'rooms has replica identity full' );

select * from finish();
rollback;
```

- [ ] **Step 2: Run the DB test to verify it fails**

Run: `npm run test:db`
Expected: FAIL — the 12 assertions fail because no migration has published the tables yet (or, without Docker, this run is deferred to the owner; note that in the commit and move on).

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260704120000_realtime_rooms.sql`:

```sql
-- Enable Supabase Realtime for the room-scoped tables so member changes stream
-- live to everyone viewing the room. Idempotent and safe to re-run.

-- 1. Ensure the publication exists (Supabase ships it by default; guard fresh local DBs).
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- 2. Publish each room table + set REPLICA IDENTITY FULL.
--    FULL is required so UPDATE/DELETE events carry the old row (incl. room_id),
--    which the client channel needs to match its room_id=eq.<id> filter on deletes.
do $$
declare
  t text;
  room_tables text[] := array[
    'recipes', 'shopping_list_items', 'meal_plan_entries',
    'room_members', 'room_invites', 'rooms'
  ];
  pub_all boolean;
begin
  select puballtables into pub_all from pg_publication where pubname = 'supabase_realtime';
  foreach t in array room_tables loop
    -- Add to the publication only if it isn't already covered.
    if coalesce(pub_all, false) = false
       and not exists (
         select 1 from pg_publication_tables
         where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
       ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
    execute format('alter table public.%I replica identity full', t);
  end loop;
end $$;
```

- [ ] **Step 4: Append the same block to the aggregate schema file**

`supabase/setup_all.sql` is the "paste once into the SQL editor" equivalent of running every migration. Read the file, then append this section at the very end so fresh projects bootstrapped from it also get Realtime (copy the exact same two `do $$ … $$;` blocks from Step 3):

```sql

-- ========== N. REALTIME (room live sync) ==========
-- (paste the two do-blocks from 20260704120000_realtime_rooms.sql here)
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

do $$
declare
  t text;
  room_tables text[] := array[
    'recipes', 'shopping_list_items', 'meal_plan_entries',
    'room_members', 'room_invites', 'rooms'
  ];
  pub_all boolean;
begin
  select puballtables into pub_all from pg_publication where pubname = 'supabase_realtime';
  foreach t in array room_tables loop
    if coalesce(pub_all, false) = false
       and not exists (
         select 1 from pg_publication_tables
         where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
       ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
    execute format('alter table public.%I replica identity full', t);
  end loop;
end $$;
```

- [ ] **Step 5: Run the DB test to verify it passes**

Run: `npm run test:db`
Expected: PASS — `realtime_publication.test.sql` reports `ok 1..12`. (If Docker is unavailable, hand off to the owner to run and note it in the commit body.)

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260704120000_realtime_rooms.sql supabase/setup_all.sql supabase/tests/realtime_publication.test.sql
git commit -m "$(cat <<'EOF'
feat(rooms): publish room tables to Supabase Realtime

Adds recipes, shopping_list_items, meal_plan_entries, room_members,
room_invites and rooms to the supabase_realtime publication with
REPLICA IDENTITY FULL, plus a pgTAP test asserting it. Idempotent.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: The `RoomRealtime` subscriber component

**Files:**
- Create: `src/components/room-realtime.tsx`
- Test: `src/components/__tests__/room-realtime.test.tsx`

**Interfaces:**
- Consumes: `createClient()` from `@/utils/supabase/client`; `useRouter` from `next/navigation`; the publication from Task 1.
- Produces: `export function RoomRealtime({ roomId }: { roomId: string })` — a component that renders `null` and, while mounted, refreshes the current route (debounced ~300 ms) whenever a row in this room's tables changes. Task 3 renders it.

**Before coding:** read `node_modules/next/dist/docs/` for `router.refresh()` behavior in Next 16, and confirm `supabase-js` v2 `.channel().on('postgres_changes', …)` usage.

- [ ] **Step 1: Write the failing tests**

Create `src/components/__tests__/room-realtime.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/__tests__/room-realtime.test.tsx`
Expected: FAIL — cannot resolve `@/components/room-realtime` (module does not exist yet).

- [ ] **Step 3: Write the component**

Create `src/components/room-realtime.tsx`:

```tsx
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/__tests__/room-realtime.test.tsx`
Expected: PASS — all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/room-realtime.tsx src/components/__tests__/room-realtime.test.tsx
git commit -m "$(cat <<'EOF'
feat(rooms): add RoomRealtime subscriber

Client component that opens one Supabase Realtime channel per room and
calls router.refresh() (debounced 300ms) on any member change. Handles
reconnect catch-up, JWT auth for RLS, and channel cleanup.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Wire the subscriber into a room layout + document the smoke test

**Files:**
- Create: `src/app/rooms/[roomId]/layout.tsx`
- Test: `src/app/rooms/[roomId]/__tests__/layout.test.tsx`
- Modify: `README.md`

**Interfaces:**
- Consumes: `RoomRealtime` from Task 2 (`export function RoomRealtime({ roomId }: { roomId: string })`).
- Produces: a Next.js layout for the `/rooms/[roomId]` segment that mounts `<RoomRealtime>` once (covering all six room sub-pages) and renders `children`.

**Before coding:** read `node_modules/next/dist/docs/` for the Next 16 layout API — confirm `params` is a `Promise` that must be awaited (the sibling pages already do this, e.g. `src/app/rooms/[roomId]/page.tsx:15`).

- [ ] **Step 1: Write the failing test**

Create `src/app/rooms/[roomId]/__tests__/layout.test.tsx`:

```tsx
import RoomLayout from '../layout'
import { RoomRealtime } from '@/components/room-realtime'

describe('RoomLayout', () => {
  it('mounts RoomRealtime for the room and renders its children', async () => {
    const element = await RoomLayout({
      children: <div data-testid="child">hi</div>,
      params: Promise.resolve({ roomId: 'room-xyz' }),
    })

    // The layout returns a fragment: [<RoomRealtime/>, children]
    const kids = (element as { props: { children: unknown[] } }).props.children
    const realtime = kids.find(
      (c) => (c as { type?: unknown } | null)?.type === RoomRealtime,
    ) as { props: { roomId: string } } | undefined
    expect(realtime).toBeDefined()
    expect(realtime!.props.roomId).toBe('room-xyz')

    const child = kids.find(
      (c) => (c as { props?: Record<string, unknown> } | null)?.props?.['data-testid'] === 'child',
    )
    expect(child).toBeDefined()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run "src/app/rooms/[roomId]/__tests__/layout.test.tsx"`
Expected: FAIL — cannot resolve `../layout` (module does not exist yet).

- [ ] **Step 3: Write the layout**

Create `src/app/rooms/[roomId]/layout.tsx`:

```tsx
import type { ReactNode } from 'react'
import { RoomRealtime } from '@/components/room-realtime'

export default async function RoomLayout({
  children,
  params,
}: {
  children: ReactNode
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

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run "src/app/rooms/[roomId]/__tests__/layout.test.tsx"`
Expected: PASS.

- [ ] **Step 5: Add the two-browser smoke item to the README**

In `README.md`, in the "## End-to-end smoke checklist" section, add this item immediately after the "Plan a week" bullet (currently line 183):

```markdown
- [ ] **Live room sync (two browsers).** Sign in as two different members of the same room in two separate browsers (or a normal + incognito window), both open the same room. In browser A: check a shopping-list item, add a recipe, rename the room, or accept an invite → browser B reflects the change within ~1 second **without reloading**. (Requires the `20260704120000_realtime_rooms.sql` migration to be applied and Realtime enabled for the project.)
```

- [ ] **Step 6: Run the full test suite**

Run: `npm run test:run`
Expected: PASS — all existing tests plus the new component and layout tests are green.

- [ ] **Step 7: Commit**

```bash
git add "src/app/rooms/[roomId]/layout.tsx" "src/app/rooms/[roomId]/__tests__/layout.test.tsx" README.md
git commit -m "$(cat <<'EOF'
feat(rooms): live-sync every room page via a room layout

Mounts RoomRealtime in a new rooms/[roomId] layout so the recipe
library, shopping list, members, spin, cook and plan pages all update
live when a member makes a change. Adds a two-browser smoke test to
the README.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Owner follow-up (after merge)

These require Docker / the hosted Supabase project and are the owner's to run (consistent with how `rooms_rls.test.sql` is handled today):

1. Apply the migration to the hosted DB: `npx supabase db push` (or paste the new section from `setup_all.sql` into the Supabase SQL editor).
2. Confirm Realtime is enabled for the project (it is by default on Supabase; the migration publishes the tables).
3. Run `npm run test:db` to confirm `realtime_publication.test.sql` passes.
4. Walk the "Live room sync (two browsers)" smoke item.

## Self-Review

**Spec coverage:**
- Enable Realtime on the 6 room tables + `replica identity full` → Task 1. ✓
- Reusable subscriber, one channel per room, debounced `router.refresh()`, reconnect catch-up, cleanup, JWT/RLS auth → Task 2. ✓
- New `rooms/[roomId]/layout.tsx` covering all six room pages → Task 3. ✓
- pgTAP publication + replica-identity test → Task 1. ✓
- Two-browser smoke test documented → Task 3 (README). ✓
- "Do not publish `ingredients`/`steps`" (recipe edits bump `recipes.updated_at`) → honored: Task 1 publishes only the 6 tables; not a gap. ✓
- Presence / personal pages explicitly out of scope → no task, correct. ✓

**Placeholder scan:** No `TBD`/`TODO`/"handle edge cases". The one intentional fill-in is `-- ========== N. …` in `setup_all.sql` (the section number `N` depends on the file's existing sections — the implementer picks the next number when appending). Migration timestamp is concrete (`20260704120000`).

**Type consistency:** `RoomRealtime({ roomId }: { roomId: string })` is defined in Task 2 and consumed identically in Task 3's layout and both tests. `createClient` (no args) matches `src/utils/supabase/client.ts`. `router.refresh()` matches the app-wide pattern. Table list (`recipes`, `shopping_list_items`, `meal_plan_entries`, `room_members`, `room_invites`, `rooms`) is identical in the migration, the aggregate schema, the pgTAP test, and the component.
