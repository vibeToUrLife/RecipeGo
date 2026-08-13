# Room sub-nav + configurable week-start — Design

**Date:** 2026-07-05
**Status:** Approved, ready for implementation planning
**Author:** Claude + owner

## Goals

Two independent improvements, plus one already-resolved bug:

1. **Shared room button row (`RoomSubNav`).** A single teal button row, defined once
   (not hardcoded per page), shown on **every** room page, letting members jump between
   the room's places: 食谱 Recipes · 成员 Members · 食材 Ingredients · 购物清单 Shopping
   list · 计划 Plan. The current page is highlighted.
2. **Configurable week-start (any day), per user.** On the Plan page, let each user
   choose which weekday the week starts on (Mon–Sun). Saved to their profile, so it
   applies to both personal and room plans, on every device.
3. **Next-week navigation bug — already resolved.** Verified below; no code change.

## Background (current state)

- **Header nav** (`AppNav` → `NavLinks`): four ghost-styled links (Recipes/Plan/
  Ingredients/Shopping list), room-aware hrefs (rewritten to `/rooms/{id}/…` when in a
  room via an explicit `roomId` prop or `useCurrentRoomId()`). Hand-written JSX, not a
  data array. Header has **no** Members and **no** Spin.
- **The teal row** lives **only** on the room home page `src/app/rooms/[roomId]/page.tsx`
  (lines 28–38): a `flex flex-wrap gap-3` div with exactly 3 `Button asChild
  variant="secondary" size="sm"` links — Members, Ingredients (`/cook`), Shopping list.
  It disappears on all 5 sub-pages (shopping-list, members, spin, cook, plan).
- **Teal styling** = `variant="secondary"` (`--secondary` ≈ oklch hue 121, a muted
  green-teal, theme-aware) + `size="sm"`. `asChild` merges only `className` onto the
  child `<Link>` — it does **not** forward `aria-*`, so `aria-current` must be set on the
  `<Link>`, not the `<Button>`.
- **Plan week logic**: `src/lib/plan/week.ts` `startOfWeek` is **hardcoded Monday**
  (`diff = (getDay()+6)%7`). Both `/plan` and `/rooms/[roomId]/plan` read a `?week=`
  search param, normalize it through `startOfWeek`, and fall back to today's week start
  when absent/invalid. `WeekPlanner` derives prev/next from the **viewed** week
  (`addWeeks(±1)`), so navigation is correct. Meals are stored per exact date
  (`meal_plan_entries.plan_date`), not per week.
- **Profiles**: `public.profiles` (per-user, RLS: anyone reads, owner updates own row).
  Natural home for a `week_starts_on` preference.

### Request 3 — next-week bug: resolved, not a code defect

Reproduced live on the **freshly-restarted** dev server: from the current week, clicking
`>` went to `?week=2026-07-06` (next week rendered), and again to `?week=2026-07-13`.
Navigation advances correctly week by week. The earlier symptom ("stays on this week") was
the **stale/corrupted dev server** (the same broken Turbopack state that crashed the room
route), not the code. **No change required.** If it ever recurs on production, investigate
separately.

## Feature 1 — `RoomSubNav`

### Component

New `src/components/room-subnav.tsx`, a `'use client'` component (client so it can
highlight the active page via `usePathname()`), using `useT()` for labels. Driven by a
**single module-level array** — the buttons are defined exactly once:

```tsx
const ROOM_NAV = [
  { suffix: '',               labelKey: 'nav.recipes' },      // room home / library
  { suffix: '/members',       labelKey: 'rooms.members' },
  { suffix: '/cook',          labelKey: 'nav.ingredients' },
  { suffix: '/shopping-list', labelKey: 'rooms.shoppingList' },
  { suffix: '/plan',          labelKey: 'nav.plan' },
] as const
```

For each item: `href = \`/rooms/${roomId}${suffix}\``. **Active** detection against
`usePathname()`:
- home (`suffix === ''`): active iff `pathname === \`/rooms/${roomId}\``.
- others: active iff `pathname === href || pathname.startsWith(href + '/')`.

Render a `flex flex-wrap gap-3` container of `Button asChild variant="secondary"
size="sm"` links. The active item gets a highlight class (e.g. `ring-2 ring-ring
font-semibold`) on the `Button` and `aria-current="page"` on the `<Link>` (since
`asChild` won't forward aria). All labels reuse **existing** i18n keys — **no new
strings, no DB change**.

### Placement

Render `<RoomSubNav roomId={roomId} />` near the top of the content (`<main>`) on **all
six** room pages: `page.tsx` (home), `members`, `cook`, `shopping-list`, `plan`, `spin`.
On the **home** page, delete the ad-hoc 3-button `<div>` (lines 28–38) and replace it
with `<RoomSubNav>` (no duplication). Keep each page's existing width/hero; the row sits
just under the page title/hero, above the page's main body.

## Feature 2 — configurable week-start (any day), per user

### Storage

New column on `public.profiles`:

```sql
alter table public.profiles
  add column if not exists week_starts_on smallint not null default 1
  check (week_starts_on between 0 and 6);
```

`0 = Sunday … 6 = Saturday` (JS `getDay()` convention). Default **1 = Monday** = current
behavior, so existing users are unaffected. The existing profiles UPDATE RLS policy
(owner updates own row) already covers this column — **no new policy**. Migration file
`supabase/migrations/20260705120000_week_starts_on.sql`, mirrored into `setup_all.sql`
(append an idempotent `alter table … add column if not exists`). Owner applies it to
production (like the realtime migration).

### Week math

Generalize `src/lib/plan/week.ts`:

```ts
export function startOfWeek(date: Date, weekStartsOn = 1): Date {
  const diff = (date.getDay() - weekStartsOn + 7) % 7
  return addDays(date, -diff)
}
```

`weekStartsOn = 1` reproduces today's Monday behavior exactly. `weekDays(weekStartISO)`,
`addWeeks`, `toISODate`, `fromISODate` are unchanged (they operate on an
already-normalized start). No data migration: meals keyed by exact `plan_date` simply
regroup under the new start day.

### Reading the preference

New helper `getWeekStartsOn()` in `src/lib/data/profile.ts`: reads the current user's
`profiles.week_starts_on`, returns a number, defaults to `1` on any miss. **It must
tolerate the column not existing yet** — the code deploys to production *before* the owner
applies the migration, so a select referencing `week_starts_on` will error until then. On
any query error (or null), return `1`. This keeps the Plan page fully working pre-migration
(it simply behaves as Monday-start, and the selector's save is a no-op/handled error until
the column exists). Both plan pages call it and thread the value into their
`startOfWeek(...)` calls (for `todayWeekISO` and the `?week=` normalization). `WeekPlanner` needs no week-math change (it already takes the
normalized `weekStartISO`); it receives `weekStartsOn` only to render the selector.

### Selector UI + save

New `src/components/week-start-selector.tsx`, `'use client'`: a `<select>` (or the app's
dropdown) of 7 weekday options showing the current value, rendered by `WeekPlanner` in its
week-nav header (near `< 本周 >`), so it appears on both `/plan` and `/rooms/[id]/plan`.
On change it calls a server action and refreshes:

- `setWeekStartAction(weekStartsOn: number)` in `src/app/plan/actions.ts`: validates
  `0..6`, updates `profiles.week_starts_on` for the current user,
  `revalidatePath('/', 'layout')`; the client then `router.refresh()` so the grid
  re-lays-out.

New i18n keys (EN + 中文): `plan.weekStartsOn` ("Week starts on" / "一周开始于") and seven
weekday names `weekday.0`…`weekday.6` (Sunday…Saturday / 星期日…星期六).

## Testing

- **Unit (`week.ts`)**: `startOfWeek` with `weekStartsOn` = 1 (Monday, existing), 0
  (Sunday), 3 (Wednesday) — correct start dates, no off-by-one; `weekStartsOn` default
  still Monday.
- **Unit (`RoomSubNav`)**: renders the 5 expected links with correct hrefs for a given
  `roomId`; marks exactly the active item (`aria-current="page"`) for a mocked
  `usePathname()`.
- **Migration**: a pgTAP test asserting `profiles.week_starts_on` exists with default 1
  and the `0..6` check (owner-run via `supabase test db`, like the realtime test).
- **Manual**: the teal row shows and highlights the current page on each room page; the
  selector changes the week's first day and persists across reloads (personal + room).

## Owner follow-up (post-merge)

Apply `20260705120000_week_starts_on.sql` to production Supabase
(`bdnsjmwcfvnyuztcfkjb`) — the `week_starts_on` column must exist before the selector can
save. The `RoomSubNav` feature needs no DB change and works immediately on deploy.

## Out of scope (YAGNI)

- Spin in the room row (owner chose 5 buttons, no Spin — Spin stays reachable from the
  recipe page's 帮我选 button).
- Per-room week-start (it's a per-user preference).
- Active highlighting in the header nav (unchanged).
