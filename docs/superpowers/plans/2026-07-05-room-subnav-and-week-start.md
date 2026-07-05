# Room Sub-Nav + Configurable Week-Start Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared teal room-navigation button row on every room page, and let each user choose which weekday the week starts on (Plan page), stored per-user.

**Architecture:** Feature 1 is one config-driven client component (`RoomSubNav`) dropped into all six room pages. Feature 2 threads a per-user `week_starts_on` preference (new `profiles` column) into the already-pure `startOfWeek` week math, plus a small selector that saves it. The reported next-week bug was a stale dev server — no code change.

**Tech Stack:** Next.js 16 (App Router, React 19), Supabase (Postgres + RLS), Vitest + Testing Library (jsdom), Tailwind v4.

## Global Constraints

- **"This is NOT the Next.js you know."** Next 16.2.9. Per `AGENTS.md`, skim `node_modules/next/dist/docs/` before writing new component/page code if unsure about an API. Server pages `await` `params`/`searchParams` (already the pattern).
- **i18n:** every user-facing string uses `t('key')`. Client components use `useT()` from `@/components/i18n-provider`; server components use `await getT()` from `@/lib/i18n-server`. New keys go in **both** the EN dict and the 中文 dict in `src/lib/i18n.ts`. Never hardcode English.
- **Teal button styling** = `Button` `variant="secondary"` `size="sm"` (from `@/components/ui/button`). `asChild` merges only `className` onto the child `<Link>` — put `aria-current` on the `<Link>`, not the `<Button>`.
- **Client freshness** after a mutation: `router.refresh()` from `next/navigation` (see `language-switcher.tsx`).
- **Week-day convention:** `0 = Sunday … 6 = Saturday` (JS `Date.getDay()`). Default `1 = Monday` (current behavior).
- **Vitest:** tests under `src/**/*.{test,spec}.{ts,tsx}`; jsdom + `globals: true` (but import `{ describe, it, expect, vi, beforeEach }` from `'vitest'` explicitly, per repo convention). Run one file: `npx vitest run <path>`; full suite: `npm run test:run`.
- **Migration filenames** `YYYYMMDDHHMMSS_name.sql`, must sort after `20260704120000_realtime_rooms.sql`. This plan uses `20260705120000_week_starts_on.sql`.
- **DB tests** (`npm run test:db`) need Docker and are **deferred to the owner** (like `rooms_rls.test.sql`).
- **Commit trailer:** end every commit message with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Work on branch `feat/room-subnav-week-start` (already created).

## File Structure

| File | New/Modified | Responsibility |
| --- | --- | --- |
| `src/components/room-subnav.tsx` | Create | Config-driven teal room nav row with active highlight. |
| `src/components/__tests__/room-subnav.test.tsx` | Create | Unit test for links + active state. |
| `src/app/rooms/[roomId]/page.tsx` | Modify | Replace the ad-hoc 3-button row with `<RoomSubNav>`. |
| `src/app/rooms/[roomId]/{members,shopping-list,spin,cook,plan}/page.tsx` | Modify | Add `<RoomSubNav>` near the top. |
| `supabase/migrations/20260705120000_week_starts_on.sql` | Create | `profiles.week_starts_on` column. |
| `supabase/setup_all.sql` | Modify | Mirror the column (idempotent). |
| `supabase/tests/week_starts_on.test.sql` | Create | pgTAP: column exists / type / not-null. |
| `src/lib/plan/week.ts` | Modify | `startOfWeek(date, weekStartsOn=1)`. |
| `src/lib/plan/__tests__/week.test.ts` | Modify | Add Sunday/Wednesday start tests. |
| `src/lib/data/profile.ts` | Create | `getWeekStartsOn()` (tolerant of missing column). |
| `src/lib/data/__tests__/profile.test.ts` | Create | Unit test for the helper. |
| `src/app/plan/page.tsx`, `src/app/rooms/[roomId]/plan/page.tsx` | Modify | Compute week from the pref; pass it to `WeekPlanner`. |
| `src/components/week-start-selector.tsx` | Create | The day-of-week `<select>` that saves the pref. |
| `src/components/__tests__/week-start-selector.test.tsx` | Create | Unit test for the selector. |
| `src/app/plan/actions.ts` | Modify | `setWeekStartAction`. |
| `src/components/week-planner.tsx` | Modify | Accept `weekStartsOn`; render the selector. |
| `src/lib/i18n.ts` | Modify | New keys: `plan.weekStartsOn`, `weekday.0…6` (EN + 中文). |

---

### Task 1: `RoomSubNav` component

**Files:**
- Create: `src/components/room-subnav.tsx`
- Test: `src/components/__tests__/room-subnav.test.tsx`

**Interfaces:**
- Consumes: `Button` from `@/components/ui/button`; `useT` from `@/components/i18n-provider`; `usePathname` from `next/navigation`; `cn` from `@/lib/utils`.
- Produces: `export function RoomSubNav({ roomId }: { roomId: string })` — a `<nav>` of 5 teal `<Link>` buttons, the active one marked `aria-current="page"`. Task 2 renders it.

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/room-subnav.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { RoomSubNav } from '@/components/room-subnav'

const nav = vi.hoisted(() => ({ pathname: '/rooms/r1' }))
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }))
vi.mock('@/components/i18n-provider', () => ({ useT: () => (k: string) => k }))

describe('RoomSubNav', () => {
  it('renders the 5 room links with correct hrefs', () => {
    nav.pathname = '/rooms/r1'
    render(<RoomSubNav roomId="r1" />)
    expect(screen.getByText('nav.recipes').closest('a')).toHaveAttribute('href', '/rooms/r1')
    expect(screen.getByText('rooms.members').closest('a')).toHaveAttribute('href', '/rooms/r1/members')
    expect(screen.getByText('nav.ingredients').closest('a')).toHaveAttribute('href', '/rooms/r1/cook')
    expect(screen.getByText('rooms.shoppingList').closest('a')).toHaveAttribute('href', '/rooms/r1/shopping-list')
    expect(screen.getByText('nav.plan').closest('a')).toHaveAttribute('href', '/rooms/r1/plan')
  })

  it('marks the current sub-page active, and not the home link', () => {
    nav.pathname = '/rooms/r1/plan'
    render(<RoomSubNav roomId="r1" />)
    expect(screen.getByText('nav.plan').closest('a')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('nav.recipes').closest('a')).not.toHaveAttribute('aria-current')
    expect(screen.getByText('rooms.members').closest('a')).not.toHaveAttribute('aria-current')
  })

  it('marks the home link active on the room home', () => {
    nav.pathname = '/rooms/r1'
    render(<RoomSubNav roomId="r1" />)
    expect(screen.getByText('nav.recipes').closest('a')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('nav.plan').closest('a')).not.toHaveAttribute('aria-current')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/__tests__/room-subnav.test.tsx`
Expected: FAIL — cannot resolve `@/components/room-subnav`.

- [ ] **Step 3: Write the component**

Create `src/components/room-subnav.tsx`:

```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useT } from '@/components/i18n-provider'
import { cn } from '@/lib/utils'

// Defined once — the room's navigable places. Reuses existing i18n keys.
const ROOM_NAV = [
  { suffix: '', labelKey: 'nav.recipes' },
  { suffix: '/members', labelKey: 'rooms.members' },
  { suffix: '/cook', labelKey: 'nav.ingredients' },
  { suffix: '/shopping-list', labelKey: 'rooms.shoppingList' },
  { suffix: '/plan', labelKey: 'nav.plan' },
] as const

export function RoomSubNav({ roomId }: { roomId: string }) {
  const t = useT()
  const pathname = usePathname()
  const base = `/rooms/${roomId}`
  return (
    <nav className="mb-6 flex flex-wrap gap-3">
      {ROOM_NAV.map(({ suffix, labelKey }) => {
        const href = `${base}${suffix}`
        const active =
          suffix === '' ? pathname === base : pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Button
            key={suffix || 'home'}
            asChild
            variant="secondary"
            size="sm"
            className={cn(active && 'ring-2 ring-ring font-semibold')}
          >
            <Link href={href} aria-current={active ? 'page' : undefined}>
              {t(labelKey)}
            </Link>
          </Button>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/__tests__/room-subnav.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/room-subnav.tsx src/components/__tests__/room-subnav.test.tsx
git commit -m "$(cat <<'EOF'
feat(rooms): add config-driven RoomSubNav (teal nav row)

One shared component for the room's places (Recipes/Members/Ingredients/
Shopping list/Plan), reusing existing i18n keys, active page highlighted.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Show `RoomSubNav` on all six room pages

**Files:**
- Modify: `src/app/rooms/[roomId]/page.tsx` (replace the 3-button row)
- Modify: `src/app/rooms/[roomId]/members/page.tsx`
- Modify: `src/app/rooms/[roomId]/shopping-list/page.tsx`
- Modify: `src/app/rooms/[roomId]/spin/page.tsx`
- Modify: `src/app/rooms/[roomId]/cook/page.tsx`
- Modify: `src/app/rooms/[roomId]/plan/page.tsx`

**Interfaces:**
- Consumes: `RoomSubNav` from `@/components/room-subnav` (Task 1).
- Produces: the teal row on every room page. No exports.

This is a composition task (server pages rendering a client component), verified by build + the existing suite + a visual check — there is no unit test for it.

- [ ] **Step 1: Room home — replace the ad-hoc button row**

In `src/app/rooms/[roomId]/page.tsx`: add the import `import { RoomSubNav } from '@/components/room-subnav'`. Then **delete** the entire 3-button `<div>` (the block `<div className="mb-6 flex flex-wrap gap-3"> … </div>` containing the Members/Ingredients/Shopping-list buttons) and put in its place:

```tsx
        <RoomSubNav roomId={roomId} />
```

Then **remove the now-unused imports** `import Link from 'next/link'` and `import { Button } from '@/components/ui/button'` (they were only used by the deleted row; `RecipeLibrary` and the rest stay).

- [ ] **Step 2: Add the row to the other five pages**

In each of these files, add `import { RoomSubNav } from '@/components/room-subnav'` and render `<RoomSubNav roomId={roomId} />` at the stated spot inside `<main>`:

- `members/page.tsx`: immediately **after** the `<h1>…membersTitle…</h1>` line (before the `{sp.error && …}` block).
- `shopping-list/page.tsx`: immediately **after** the `<h1>…shop.roomTitle…</h1>` line (before `<ShoppingListView …/>`).
- `spin/page.tsx`: immediately **after** the closing `</section>` of the gradient hero (before `<SpinWheel …/>`).
- `cook/page.tsx`: immediately **after** the closing `</section>` of the gradient hero (before `<CookPlanner …/>`).
- `plan/page.tsx`: immediately **after** the `<h1>…plan.roomTitle…</h1>` line (before `<WeekPlanner …/>`).

Each of these pages already has `roomId` in scope (`const { roomId } = await params`).

- [ ] **Step 3: Build + full suite (no regressions)**

Run: `npm run build`
Expected: builds clean (this also catches the removed-import cleanup on the home page).
Run: `npm run test:run`
Expected: all tests pass.

- [ ] **Step 4: Visual check (dev server)**

With `npm run dev` running, open a room and click through Recipes → Members → Ingredients → Shopping list → Plan. Confirm the teal row appears on **every** page and the **current** page's button is highlighted (ring + bold). (Spin page also shows the row even though Spin isn't in it.)

- [ ] **Step 5: Commit**

```bash
git add "src/app/rooms/[roomId]"
git commit -m "$(cat <<'EOF'
feat(rooms): show RoomSubNav on every room page

Replace the room home's hardcoded 3-button row with the shared
RoomSubNav and add it to members/shopping-list/spin/cook/plan so the
teal nav is consistent across the room.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `profiles.week_starts_on` migration

**Files:**
- Create: `supabase/migrations/20260705120000_week_starts_on.sql`
- Modify: `supabase/setup_all.sql` (append an idempotent alter at the end)
- Test: `supabase/tests/week_starts_on.test.sql`

**Interfaces:**
- Produces: a `smallint not null default 1` column `week_starts_on` on `public.profiles`, constrained `0..6`. Tasks 5–6 read/write it. Existing profiles UPDATE RLS (owner updates own row) already covers it — no new policy.

- [ ] **Step 1: Write the failing DB test**

Create `supabase/tests/week_starts_on.test.sql`:

```sql
-- supabase/tests/week_starts_on.test.sql
-- pgTAP: profiles has the week_starts_on preference column.
-- Run with: supabase test db  (Docker required — deferred to owner)
begin;
select plan(3);
select has_column('public', 'profiles', 'week_starts_on', 'profiles has week_starts_on');
select col_type_is('public', 'profiles', 'week_starts_on', 'smallint', 'week_starts_on is smallint');
select col_not_null('public', 'profiles', 'week_starts_on', 'week_starts_on is NOT NULL');
select * from finish();
rollback;
```

- [ ] **Step 2: Run the DB test to verify it fails**

Run: `npm run test:db`
Expected: FAIL (column doesn't exist). If Docker is unavailable, note the run is deferred to the owner and continue.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260705120000_week_starts_on.sql`:

```sql
-- Per-user preferred first day of the week for the meal planner.
-- 0=Sunday … 6=Saturday. Default 1 (Monday) = existing behavior. Idempotent.
alter table public.profiles
  add column if not exists week_starts_on smallint not null default 1
  check (week_starts_on between 0 and 6);
```

- [ ] **Step 4: Mirror into the aggregate schema**

Read `supabase/setup_all.sql`, then append at the very end (idempotent, safe on a fresh install):

```sql

-- ========== N. WEEK-START PREFERENCE ==========
alter table public.profiles
  add column if not exists week_starts_on smallint not null default 1
  check (week_starts_on between 0 and 6);
```

(Replace `N` with the next section number after the highest existing `========== <number>.` in the file.)

- [ ] **Step 5: Run the DB test to verify it passes**

Run: `npm run test:db`
Expected: PASS (`ok 1..3`). If Docker is unavailable, hand off to the owner and note the deferral in the commit body.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260705120000_week_starts_on.sql supabase/setup_all.sql supabase/tests/week_starts_on.test.sql
git commit -m "$(cat <<'EOF'
feat(plan): add profiles.week_starts_on preference column

smallint 0..6, default 1 (Monday). Idempotent migration + setup_all
mirror + pgTAP. Existing profiles UPDATE RLS covers it.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Generalize `startOfWeek(date, weekStartsOn)`

**Files:**
- Modify: `src/lib/plan/week.ts:6-11`
- Test: `src/lib/plan/__tests__/week.test.ts`

**Interfaces:**
- Produces: `startOfWeek(date: Date, weekStartsOn = 1): Date`. Default `1` reproduces today's Monday behavior exactly. Consumed by Task 5.

- [ ] **Step 1: Add the failing tests**

In `src/lib/plan/__tests__/week.test.ts`, add these cases inside the existing `describe('startOfWeek', …)` block (after the Sunday test at line 16):

```ts
  it('supports a Sunday start (weekStartsOn=0)', () => {
    expect(toISODate(startOfWeek(new Date(2026, 6, 1), 0))).toBe('2026-06-28') // Wed 1 Jul -> Sun 28 Jun
    expect(toISODate(startOfWeek(new Date(2026, 6, 5), 0))).toBe('2026-07-05') // Sun 5 Jul -> same Sunday
  })
  it('supports a Wednesday start (weekStartsOn=3)', () => {
    expect(toISODate(startOfWeek(new Date(2026, 6, 1), 3))).toBe('2026-07-01') // Wed 1 Jul -> same Wednesday
    expect(toISODate(startOfWeek(new Date(2026, 5, 30), 3))).toBe('2026-06-24') // Tue 30 Jun -> prev Wed 24 Jun
  })
  it('defaults to a Monday start when weekStartsOn is omitted', () => {
    expect(toISODate(startOfWeek(new Date(2026, 6, 1)))).toBe('2026-06-29') // Wed 1 Jul -> Mon 29 Jun
  })
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npx vitest run src/lib/plan/__tests__/week.test.ts`
Expected: FAIL — `startOfWeek` currently ignores a second argument, so the Sunday/Wednesday cases return the Monday result.

- [ ] **Step 3: Generalize the function**

In `src/lib/plan/week.ts`, replace the `startOfWeek` function (lines 5-11) with:

```ts
// Start (00:00 local) of the week containing `date`.
// weekStartsOn: 0=Sunday … 6=Saturday. Default 1 = Monday.
export function startOfWeek(date: Date, weekStartsOn = 1): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diff = (d.getDay() - weekStartsOn + 7) % 7 // days since the chosen start day
  d.setDate(d.getDate() - diff)
  return d
}
```

- [ ] **Step 4: Run to verify all pass**

Run: `npx vitest run src/lib/plan/__tests__/week.test.ts`
Expected: PASS (existing Monday tests + the 3 new cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/plan/week.ts src/lib/plan/__tests__/week.test.ts
git commit -m "$(cat <<'EOF'
feat(plan): make startOfWeek accept a weekStartsOn (default Monday)

0=Sunday..6=Saturday; default 1 preserves existing behavior. Tests for
Sunday and Wednesday starts, no off-by-one.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `getWeekStartsOn()` + use it in both plan pages

**Files:**
- Create: `src/lib/data/profile.ts`
- Test: `src/lib/data/__tests__/profile.test.ts`
- Modify: `src/app/plan/page.tsx`, `src/app/rooms/[roomId]/plan/page.tsx`

**Interfaces:**
- Consumes: `createClient` from `@/utils/supabase/server`; `startOfWeek(date, weekStartsOn)` (Task 4).
- Produces: `export async function getWeekStartsOn(): Promise<number>` (0..6, default 1, tolerant of a missing column). Both plan pages now compute the week from it and hold a `weekStartsOn` local (Task 6 passes it to `WeekPlanner`).

- [ ] **Step 1: Write the failing helper test**

Create `src/lib/data/__tests__/profile.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const holder = vi.hoisted(() => ({
  user: { id: 'u1' } as { id: string } | null,
  single: { data: { week_starts_on: 0 } as { week_starts_on: number } | null, error: null as unknown },
}))
vi.mock('@/utils/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: holder.user } }) },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => holder.single }) }) }),
  }),
}))
import { getWeekStartsOn } from '@/lib/data/profile'

beforeEach(() => {
  holder.user = { id: 'u1' }
  holder.single = { data: { week_starts_on: 0 }, error: null }
})

describe('getWeekStartsOn', () => {
  it('returns the stored preference', async () => {
    holder.single = { data: { week_starts_on: 0 }, error: null }
    expect(await getWeekStartsOn()).toBe(0)
  })
  it('defaults to 1 when not signed in', async () => {
    holder.user = null
    expect(await getWeekStartsOn()).toBe(1)
  })
  it('defaults to 1 on a query error (e.g. column missing pre-migration)', async () => {
    holder.single = { data: null, error: { message: 'column does not exist' } }
    expect(await getWeekStartsOn()).toBe(1)
  })
  it('defaults to 1 for an out-of-range value', async () => {
    holder.single = { data: { week_starts_on: 9 }, error: null }
    expect(await getWeekStartsOn()).toBe(1)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/data/__tests__/profile.test.ts`
Expected: FAIL — cannot resolve `@/lib/data/profile`.

- [ ] **Step 3: Write the helper**

Create `src/lib/data/profile.ts`:

```ts
import { createClient } from '@/utils/supabase/server'

// The user's preferred first day of the week: 0=Sunday … 6=Saturday.
// Defaults to 1 (Monday). Tolerates the column not existing yet — production
// deploys before the migration is applied, so a select on week_starts_on errors
// until then; in every failure path we fall back to Monday.
export async function getWeekStartsOn(): Promise<number> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return 1
    const { data, error } = await supabase
      .from('profiles')
      .select('week_starts_on')
      .eq('id', user.id)
      .single()
    if (error || data?.week_starts_on == null) return 1
    const v = Number(data.week_starts_on)
    return Number.isInteger(v) && v >= 0 && v <= 6 ? v : 1
  } catch {
    return 1
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/data/__tests__/profile.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Use the preference in the personal plan page**

In `src/app/plan/page.tsx`: add `import { getWeekStartsOn } from '@/lib/data/profile'`. Replace the body lines that compute the week (currently lines 15-17) with:

```tsx
  const { week } = await searchParams
  const weekStartsOn = await getWeekStartsOn()
  const todayWeekISO = toISODate(startOfWeek(new Date(), weekStartsOn))
  const weekStartISO = week && ISO.test(week) ? toISODate(startOfWeek(fromISODate(week), weekStartsOn)) : todayWeekISO
```

(Leave the `Promise.all([getWeekPlan(weekStartISO), listRecipes(), getT()])` line and the JSX as-is; `weekStartsOn` is now in scope for Task 6.)

- [ ] **Step 6: Use the preference in the room plan page**

In `src/app/rooms/[roomId]/plan/page.tsx`: add `import { getWeekStartsOn } from '@/lib/data/profile'`. Replace the two week-computation lines (currently lines 21-22) with:

```tsx
  const weekStartsOn = await getWeekStartsOn()
  const todayWeekISO = toISODate(startOfWeek(new Date(), weekStartsOn))
  const weekStartISO = week && ISO.test(week) ? toISODate(startOfWeek(fromISODate(week), weekStartsOn)) : todayWeekISO
```

- [ ] **Step 7: Build + full suite**

Run: `npm run build`
Expected: clean.
Run: `npm run test:run`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/data/profile.ts src/lib/data/__tests__/profile.test.ts src/app/plan/page.tsx "src/app/rooms/[roomId]/plan/page.tsx"
git commit -m "$(cat <<'EOF'
feat(plan): lay out the week from the user's week_starts_on

Add getWeekStartsOn() (defaults to Monday, tolerant of the column not
existing yet) and thread it into both plan pages' startOfWeek calls.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Week-start selector (UI + save)

**Files:**
- Modify: `src/lib/i18n.ts` (new keys, EN + 中文)
- Modify: `src/app/plan/actions.ts` (`setWeekStartAction`)
- Create: `src/components/week-start-selector.tsx`
- Test: `src/components/__tests__/week-start-selector.test.tsx`
- Modify: `src/components/week-planner.tsx` (accept `weekStartsOn`, render the selector)
- Modify: `src/app/plan/page.tsx`, `src/app/rooms/[roomId]/plan/page.tsx` (pass `weekStartsOn` to `WeekPlanner`)

**Interfaces:**
- Consumes: `weekStartsOn` local from both plan pages (Task 5); `setWeekStartAction` (this task); `useT`, `useRouter`, `toast`.
- Produces: `setWeekStartAction(weekStartsOn: number): Promise<{ ok?: true; error?: string }>`; `WeekStartSelector({ value }: { value: number })`; `WeekPlanner` gains a required `weekStartsOn: number` prop.

- [ ] **Step 1: Add the i18n keys (EN + 中文)**

In `src/lib/i18n.ts`, in the **EN** dictionary add after `'nav.plan': 'Plan',` (line 33):

```ts
  'plan.weekStartsOn': 'Week starts on',
  'weekday.0': 'Sunday',
  'weekday.1': 'Monday',
  'weekday.2': 'Tuesday',
  'weekday.3': 'Wednesday',
  'weekday.4': 'Thursday',
  'weekday.5': 'Friday',
  'weekday.6': 'Saturday',
```

Then in the **中文** dictionary (find the block with `'nav.plan': '计划',`) add after it:

```ts
  'plan.weekStartsOn': '一周开始于',
  'weekday.0': '星期日',
  'weekday.1': '星期一',
  'weekday.2': '星期二',
  'weekday.3': '星期三',
  'weekday.4': '星期四',
  'weekday.5': '星期五',
  'weekday.6': '星期六',
```

- [ ] **Step 2: Write the failing selector test**

Create `src/components/__tests__/week-start-selector.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const action = vi.hoisted(() => ({ fn: vi.fn(async (_n: number) => ({ ok: true as const })) }))
const refresh = vi.fn()
vi.mock('@/app/plan/actions', () => ({ setWeekStartAction: (n: number) => action.fn(n) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('@/components/i18n-provider', () => ({ useT: () => (k: string) => k }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
import { WeekStartSelector } from '@/components/week-start-selector'

beforeEach(() => {
  action.fn.mockClear()
  action.fn.mockResolvedValue({ ok: true })
  refresh.mockClear()
})

describe('WeekStartSelector', () => {
  it('shows the current value and 7 options', () => {
    render(<WeekStartSelector value={1} />)
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('1')
    expect(select.querySelectorAll('option').length).toBe(7)
  })
  it('saves the chosen day and refreshes', async () => {
    render(<WeekStartSelector value={1} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '0' } })
    await waitFor(() => expect(action.fn).toHaveBeenCalledWith(0))
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/components/__tests__/week-start-selector.test.tsx`
Expected: FAIL — cannot resolve `@/components/week-start-selector` (and `setWeekStartAction` not exported yet).

- [ ] **Step 4: Add the server action**

In `src/app/plan/actions.ts`, add the import at the top (after the existing imports):

```ts
import { createClient } from '@/utils/supabase/server'
```

and add this action at the end of the file:

```ts
export async function setWeekStartAction(
  weekStartsOn: number,
): Promise<{ ok?: true; error?: string }> {
  if (!Number.isInteger(weekStartsOn) || weekStartsOn < 0 || weekStartsOn > 6) {
    return { error: 'Invalid day.' }
  }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in.' }
  const { error } = await supabase
    .from('profiles')
    .update({ week_starts_on: weekStartsOn })
    .eq('id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return { ok: true }
}
```

- [ ] **Step 5: Write the selector component**

Create `src/components/week-start-selector.tsx`:

```tsx
'use client'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { setWeekStartAction } from '@/app/plan/actions'
import { useT } from '@/components/i18n-provider'

const DAYS = [0, 1, 2, 3, 4, 5, 6] as const

export function WeekStartSelector({ value }: { value: number }) {
  const t = useT()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <span>{t('plan.weekStartsOn')}</span>
      <select
        value={value}
        disabled={pending}
        aria-label={t('plan.weekStartsOn')}
        onChange={(e) => {
          const next = Number(e.target.value)
          startTransition(async () => {
            const res = await setWeekStartAction(next)
            if (res.error) {
              toast.error(res.error)
              return
            }
            router.refresh()
          })
        }}
        className="h-8 rounded-lg border border-input bg-background px-2 text-sm text-foreground"
      >
        {DAYS.map((d) => (
          <option key={d} value={d}>
            {t(`weekday.${d}`)}
          </option>
        ))}
      </select>
    </label>
  )
}
```

- [ ] **Step 6: Run to verify the selector test passes**

Run: `npx vitest run src/components/__tests__/week-start-selector.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 7: Render the selector in `WeekPlanner`**

In `src/components/week-planner.tsx`:

1. Add the import: `import { WeekStartSelector } from '@/components/week-start-selector'`.
2. Add `weekStartsOn: number` to the props type and destructuring — change the signature block (lines 18-26) so the destructure includes `weekStartsOn` and the type includes `weekStartsOn: number`.
3. Change the header row so the week-nav and the selector sit together on the left. Replace the nav `<div className="flex items-center gap-1"> … </div>` (lines 52-60) by wrapping it and the selector:

```tsx
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <Button asChild variant="outline" size="icon" className="h-8 w-8" aria-label={t('plan.prevWeek')}>
              <Link href={`${base}?week=${prev}`}><ChevronLeft className="size-4" /></Link>
            </Button>
            <Button asChild variant="outline" size="sm"><Link href={`${base}?week=${thisWeek}`}>{t('plan.thisWeek')}</Link></Button>
            <Button asChild variant="outline" size="icon" className="h-8 w-8" aria-label={t('plan.nextWeek')}>
              <Link href={`${base}?week=${next}`}><ChevronRight className="size-4" /></Link>
            </Button>
          </div>
          <WeekStartSelector value={weekStartsOn} />
        </div>
```

(The outer `<div className="flex flex-wrap items-center justify-between gap-2">` and the `addWeekToShoppingListAction` button on the right stay unchanged.)

- [ ] **Step 8: Pass `weekStartsOn` from both plan pages**

In `src/app/plan/page.tsx`, add `weekStartsOn={weekStartsOn}` to the `<WeekPlanner …/>` element. In `src/app/rooms/[roomId]/plan/page.tsx`, do the same. (`weekStartsOn` is already in scope from Task 5.)

- [ ] **Step 9: Build + full suite**

Run: `npm run build`
Expected: clean (WeekPlanner's new required prop is satisfied by both callers).
Run: `npm run test:run`
Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add src/lib/i18n.ts src/app/plan/actions.ts src/components/week-start-selector.tsx src/components/__tests__/week-start-selector.test.tsx src/components/week-planner.tsx src/app/plan/page.tsx "src/app/rooms/[roomId]/plan/page.tsx"
git commit -m "$(cat <<'EOF'
feat(plan): add a "week starts on" selector on the Plan page

7-day <select> that saves week_starts_on to the profile and refreshes;
rendered in the WeekPlanner header for personal + room plans. EN/中文
labels added.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Owner follow-up (post-merge)

Apply `20260705120000_week_starts_on.sql` to production Supabase (`bdnsjmwcfvnyuztcfkjb`) — via `npx supabase db push` or by pasting the new `setup_all.sql` block into the SQL editor — so the `week_starts_on` column exists and the selector can save. `RoomSubNav` needs no DB change and works immediately on deploy. Run `npm run test:db` (Docker) to confirm the column.

## Self-Review

**Spec coverage:**
- Shared config-driven `RoomSubNav` (5 buttons incl. Plan, teal, active highlight) → Task 1. ✓
- On all six room pages, old home row removed → Task 2. ✓
- `profiles.week_starts_on` column (0..6, default 1) + setup_all + pgTAP → Task 3. ✓
- `startOfWeek(date, weekStartsOn)` generalized → Task 4. ✓
- `getWeekStartsOn()` tolerant of missing column + threaded into both plan pages → Task 5. ✓
- Selector UI + `setWeekStartAction` + WeekPlanner wiring + i18n (EN+中文, 7 days) → Task 6. ✓
- Next-week bug = stale server, no code change → documented, no task. ✓
- YAGNI held: no Spin button, no per-room week-start, no header changes. ✓

**Placeholder scan:** No `TBD`/`TODO`/"handle edge cases". The one intentional fill-in is `-- ========== N.` in `setup_all.sql` (section number depends on the file's existing sections). Migration timestamp is concrete.

**Type consistency:** `RoomSubNav({ roomId: string })`, `getWeekStartsOn(): Promise<number>`, `setWeekStartAction(weekStartsOn: number)`, `WeekStartSelector({ value: number })`, and `WeekPlanner`'s new `weekStartsOn: number` prop are used identically across their defining and consuming tasks. Day convention `0=Sun..6=Sat` is consistent in the migration, `startOfWeek`, `getWeekStartsOn`, the action, and the `weekday.0..6` keys. `startOfWeek`'s default `1` matches the pre-existing Monday behavior asserted by the unchanged tests.
