# Weekly Meal Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a weekly Breakfast/Lunch/Dinner meal planner (personal + per-Room) that lets the user set servings per meal and push the whole week's ingredients into the existing shopping list.

**Architecture:** A new `meal_plan_entries` table (dual-scoped like `shopping_list_items`), pure date/grouping helpers in `lib/plan/week.ts`, a `server-only` data layer + server actions mirroring the shopping-list modules, and client components (`WeekPlanner`, `AddMealDialog`, `PlannedMeal`) rendered by two pages (`/plan`, `/rooms/[roomId]/plan`). The "add week to shopping list" feature reuses the existing `addRecipeToList`.

**Tech Stack:** Next.js 16 (App Router, server actions), Supabase (Postgres + RLS), Tailwind v4 + shadcn/base-ui, Vitest, `sonner` toasts, `lucide-react` icons.

## Global Constraints

- **Dual-scope everywhere:** personal = `room_id is null` + `user_id = auth.uid()`; shared = `room_id is not null` + `public.is_room_member(room_id)`. Copy the `shopping_list_items` RLS verbatim.
- Data-layer functions take `roomId: string | null = null` (last param) — match existing `lib/data/*`.
- Server actions call `revalidatePath('/', 'layout')` after writes.
- i18n: every user-facing string is a key added to BOTH `EN` and `ZH` in `src/lib/i18n.ts`. Interpolation uses `{name}` placeholders (e.g. `{n}`, `{room}`).
- Week starts **Monday**. Servings range **1–1000**. Multiple recipes allowed per slot.
- Migration timestamp must sort after the latest existing one (`20260630180000`). Use `20260630190000`.
- Only `lib/plan/week.ts` gets unit tests (repo convention: pure logic is unit-tested; I/O + UI verified by `npm run build` type-check and manual smoke). `npm run test:run` must stay green.

---

### Task 1: Pure week/date + grouping logic

**Files:**
- Create: `src/lib/plan/week.ts`
- Test: `src/lib/plan/__tests__/week.test.ts`

**Interfaces:**
- Produces: `MEAL_SLOTS` (`readonly ['breakfast','lunch','dinner']`), `type MealSlot`, `startOfWeek(date: Date): Date`, `addWeeks(weekStart: Date, n: number): Date`, `weekDays(weekStart: Date): Date[]`, `toISODate(date: Date): string`, `fromISODate(s: string): Date`, `groupEntriesByDayAndSlot<T extends { plan_date: string; meal_slot: MealSlot }>(entries: T[]): Record<string, Record<MealSlot, T[]>>`.

- [ ] **Step 1: Write the failing test**

`src/lib/plan/__tests__/week.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import {
  startOfWeek, addWeeks, weekDays, toISODate, fromISODate,
  groupEntriesByDayAndSlot, MEAL_SLOTS,
} from '@/lib/plan/week'

describe('startOfWeek', () => {
  it('returns the same day for a Monday', () => {
    expect(toISODate(startOfWeek(new Date(2026, 5, 29)))).toBe('2026-06-29') // Mon 29 Jun 2026
  })
  it('returns Monday for a mid-week day', () => {
    expect(toISODate(startOfWeek(new Date(2026, 6, 1)))).toBe('2026-06-29') // Wed 1 Jul -> Mon 29 Jun
  })
  it('returns the previous Monday for a Sunday', () => {
    expect(toISODate(startOfWeek(new Date(2026, 6, 5)))).toBe('2026-06-29') // Sun 5 Jul -> Mon 29 Jun
  })
})

describe('weekDays', () => {
  it('returns 7 consecutive days Mon..Sun', () => {
    const days = weekDays(new Date(2026, 5, 29)).map(toISODate)
    expect(days).toEqual([
      '2026-06-29','2026-06-30','2026-07-01','2026-07-02','2026-07-03','2026-07-04','2026-07-05',
    ])
  })
})

describe('addWeeks', () => {
  it('shifts by whole weeks forward and back', () => {
    expect(toISODate(addWeeks(new Date(2026, 5, 29), 1))).toBe('2026-07-06')
    expect(toISODate(addWeeks(new Date(2026, 5, 29), -1))).toBe('2026-06-22')
  })
})

describe('toISODate / fromISODate', () => {
  it('pads and round-trips with no off-by-one', () => {
    expect(toISODate(new Date(2026, 0, 3))).toBe('2026-01-03')
    expect(toISODate(fromISODate('2026-01-03'))).toBe('2026-01-03')
  })
})

describe('groupEntriesByDayAndSlot', () => {
  it('buckets by day then slot and keeps multiple per slot', () => {
    const g = groupEntriesByDayAndSlot([
      { plan_date: '2026-06-29', meal_slot: 'dinner', id: 'a' },
      { plan_date: '2026-06-29', meal_slot: 'dinner', id: 'b' },
      { plan_date: '2026-06-30', meal_slot: 'breakfast', id: 'c' },
    ])
    expect(g['2026-06-29'].dinner.map((e) => e.id)).toEqual(['a', 'b'])
    expect(g['2026-06-29'].breakfast).toEqual([])
    expect(g['2026-06-30'].breakfast.map((e) => e.id)).toEqual(['c'])
  })
  it('exposes the three slots in order', () => {
    expect(MEAL_SLOTS).toEqual(['breakfast', 'lunch', 'dinner'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- week`
Expected: FAIL — cannot resolve `@/lib/plan/week`.

- [ ] **Step 3: Write minimal implementation**

`src/lib/plan/week.ts`:
```ts
// Pure week/date helpers for the meal planner. No I/O — unit-tested.
export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner'] as const
export type MealSlot = (typeof MEAL_SLOTS)[number]

// Monday 00:00 (local time) of the week containing `date`.
export function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diff = (d.getDay() + 6) % 7 // days since Monday (Sun=0 -> 6)
  d.setDate(d.getDate() - diff)
  return d
}

export function addWeeks(weekStart: Date, n: number): Date {
  const d = new Date(weekStart)
  d.setDate(d.getDate() + n * 7)
  return d
}

export function weekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })
}

// Local-time YYYY-MM-DD (avoids the UTC shift of toISOString()).
export function toISODate(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${m}-${day}`
}

export function fromISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// { 'YYYY-MM-DD': { breakfast: T[], lunch: T[], dinner: T[] } }
export function groupEntriesByDayAndSlot<
  T extends { plan_date: string; meal_slot: MealSlot },
>(entries: T[]): Record<string, Record<MealSlot, T[]>> {
  const out: Record<string, Record<MealSlot, T[]>> = {}
  for (const e of entries) {
    const day = (out[e.plan_date] ??= { breakfast: [], lunch: [], dinner: [] })
    day[e.meal_slot].push(e)
  }
  return out
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- week`
Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/plan/week.ts src/lib/plan/__tests__/week.test.ts
git commit -m "feat(plan): week/date + grouping helpers with tests"
```

---

### Task 2: Migration + types

**Files:**
- Create: `supabase/migrations/20260630190000_meal_plan.sql`
- Modify: `src/lib/db-types.ts` (append types)

**Interfaces:**
- Produces table `public.meal_plan_entries`; types `MealSlot` (re-export note: the canonical `MealSlot` lives in `lib/plan/week.ts`; `db-types.ts` imports it), `MealPlanEntry`, `MealPlanEntryView`.

- [ ] **Step 1: Write the migration**

`supabase/migrations/20260630190000_meal_plan.sql`:
```sql
-- ============ MEAL PLANNER ============
create table public.meal_plan_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  room_id    uuid references public.rooms(id) on delete cascade,   -- null = personal
  recipe_id  uuid not null references public.recipes(id) on delete cascade,
  plan_date  date not null,
  meal_slot  text not null check (meal_slot in ('breakfast','lunch','dinner')),
  servings   int  not null check (servings > 0),
  created_at timestamptz not null default now()
);
create index meal_plan_entries_scope_date_idx on public.meal_plan_entries (room_id, plan_date);
create index meal_plan_entries_recipe_id_idx on public.meal_plan_entries (recipe_id);

alter table public.meal_plan_entries enable row level security;
create policy "plan select" on public.meal_plan_entries for select to authenticated
  using ( (room_id is null and user_id = (select auth.uid()))
          or (room_id is not null and public.is_room_member(room_id)) );
create policy "plan insert" on public.meal_plan_entries for insert to authenticated
  with check ( (room_id is null and user_id = (select auth.uid()))
               or (room_id is not null and public.is_room_member(room_id)) );
create policy "plan update" on public.meal_plan_entries for update to authenticated
  using ( (room_id is null and user_id = (select auth.uid()))
          or (room_id is not null and public.is_room_member(room_id)) )
  with check ( (room_id is null and user_id = (select auth.uid()))
               or (room_id is not null and public.is_room_member(room_id)) );
create policy "plan delete" on public.meal_plan_entries for delete to authenticated
  using ( (room_id is null and user_id = (select auth.uid()))
          or (room_id is not null and public.is_room_member(room_id)) );
```

- [ ] **Step 2: Append types to `src/lib/db-types.ts`**

At the top of the file, add the import (next to the existing `import type { Aisle, Unit }`):
```ts
import type { MealSlot } from '@/lib/plan/week'
```
At the end of the file, append:
```ts
export type { MealSlot }

export interface MealPlanEntry {
  id: string
  user_id: string
  room_id: string | null
  recipe_id: string
  plan_date: string
  meal_slot: MealSlot
  servings: number
  created_at: string
}

// An entry joined with the bit the grid needs to render.
export interface MealPlanEntryView extends MealPlanEntry {
  recipe_title: string
}
```

- [ ] **Step 3: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260630190000_meal_plan.sql src/lib/db-types.ts
git commit -m "feat(plan): meal_plan_entries table + RLS + types"
```

---

### Task 3: Data layer

**Files:**
- Create: `src/lib/data/meal-plan.ts`

**Interfaces:**
- Consumes: `addRecipeToList(recipeId, servings)` from `@/lib/data/shopping`; `weekDays/fromISODate/toISODate/MealSlot` from `@/lib/plan/week`; `MealPlanEntryView` from `@/lib/db-types`.
- Produces: `getWeekPlan(weekStartISO, roomId=null)`, `addPlanEntry(input)`, `updatePlanServings(id, servings)`, `removePlanEntry(id)`, `addWeekToShoppingList(weekStartISO, roomId=null) => { meals }`.

- [ ] **Step 1: Write `src/lib/data/meal-plan.ts`**

```ts
import 'server-only'
import { createClient } from '@/utils/supabase/server'
import { addRecipeToList } from '@/lib/data/shopping'
import { weekDays, fromISODate, toISODate, type MealSlot } from '@/lib/plan/week'
import type { MealPlanEntryView } from '@/lib/db-types'

export async function getWeekPlan(
  weekStartISO: string,
  roomId: string | null = null,
): Promise<MealPlanEntryView[]> {
  const supabase = await createClient()
  const days = weekDays(fromISODate(weekStartISO)).map(toISODate)
  let q = supabase
    .from('meal_plan_entries')
    .select('*, recipes(title)')
    .gte('plan_date', days[0])
    .lte('plan_date', days[days.length - 1])
    .order('plan_date', { ascending: true })
  q = roomId ? q.eq('room_id', roomId) : q.is('room_id', null)
  const { data, error } = await q
  if (error) throw error
  type Row = Omit<MealPlanEntryView, 'recipe_title'> & { recipes: { title: string } | null }
  return ((data ?? []) as Row[]).map(({ recipes, ...rest }) => ({
    ...rest,
    recipe_title: recipes?.title ?? '',
  }))
}

export async function addPlanEntry(input: {
  recipeId: string
  planDate: string
  slot: MealSlot
  servings: number
  roomId: string | null
}): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('meal_plan_entries').insert({
    recipe_id: input.recipeId,
    plan_date: input.planDate,
    meal_slot: input.slot,
    servings: input.servings,
    room_id: input.roomId,
  })
  if (error) throw error
}

export async function updatePlanServings(id: string, servings: number): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('meal_plan_entries').update({ servings }).eq('id', id)
  if (error) throw error
}

export async function removePlanEntry(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('meal_plan_entries').delete().eq('id', id)
  if (error) throw error
}

// Push every planned meal in the week into the shopping list. addRecipeToList
// derives the scope (personal vs room) from each recipe's own room_id and
// re-merges the unchecked food rows, so we call it sequentially per entry.
export async function addWeekToShoppingList(
  weekStartISO: string,
  roomId: string | null = null,
): Promise<{ meals: number }> {
  const entries = await getWeekPlan(weekStartISO, roomId)
  for (const e of entries) {
    await addRecipeToList(e.recipe_id, e.servings)
  }
  return { meals: entries.length }
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/meal-plan.ts
git commit -m "feat(plan): meal-plan data layer"
```

---

### Task 4: Server actions

**Files:**
- Create: `src/app/plan/actions.ts`

**Interfaces:**
- Consumes: data layer from Task 3; `MEAL_SLOTS`, `MealSlot` from `@/lib/plan/week`.
- Produces: `addPlanEntryAction(input) => { ok?: true; error?: string }`, `updatePlanServingsAction(id, servings) => { ok?: true; error?: string }`, `removePlanEntryAction(id)`, `addWeekToShoppingListAction(weekStartISO, roomId=null) => { meals }`.

- [ ] **Step 1: Write `src/app/plan/actions.ts`**

```ts
'use server'
import { revalidatePath } from 'next/cache'
import {
  addPlanEntry,
  updatePlanServings,
  removePlanEntry,
  addWeekToShoppingList,
} from '@/lib/data/meal-plan'
import { MEAL_SLOTS, type MealSlot } from '@/lib/plan/week'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function cleanServings(n: unknown): number | null {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null
  const v = Math.round(n)
  return v >= 1 && v <= 1000 ? v : null
}

export async function addPlanEntryAction(input: {
  recipeId: string
  planDate: string
  slot: string
  servings: number
  roomId: string | null
}): Promise<{ ok?: true; error?: string }> {
  if (!input?.recipeId) return { error: 'Missing recipe.' }
  if (!ISO_DATE.test(input?.planDate ?? '')) return { error: 'Invalid date.' }
  if (!MEAL_SLOTS.includes(input?.slot as MealSlot)) return { error: 'Invalid meal.' }
  const servings = cleanServings(input?.servings)
  if (servings === null) return { error: 'Enter a valid number of people (1–1000).' }
  await addPlanEntry({
    recipeId: input.recipeId,
    planDate: input.planDate,
    slot: input.slot as MealSlot,
    servings,
    roomId: input.roomId ?? null,
  })
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function updatePlanServingsAction(
  id: string,
  servings: number,
): Promise<{ ok?: true; error?: string }> {
  const v = cleanServings(servings)
  if (v === null) return { error: 'Enter a valid number of people (1–1000).' }
  await updatePlanServings(id, v)
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function removePlanEntryAction(id: string) {
  await removePlanEntry(id)
  revalidatePath('/', 'layout')
}

export async function addWeekToShoppingListAction(
  weekStartISO: string,
  roomId: string | null = null,
): Promise<{ meals: number }> {
  const result = await addWeekToShoppingList(weekStartISO, roomId)
  revalidatePath('/', 'layout')
  return result
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/plan/actions.ts
git commit -m "feat(plan): server actions with validation"
```

---

### Task 5: i18n strings + nav links

**Files:**
- Modify: `src/lib/i18n.ts` (add keys to `EN` and `ZH`)
- Modify: `src/components/nav-links.tsx`
- Modify: `src/components/mobile-menu.tsx`

**Interfaces:**
- Produces i18n keys: `nav.plan`, `plan.title`, `plan.roomTitle`, `plan.thisWeek`, `plan.prevWeek`, `plan.nextWeek`, `plan.breakfast`, `plan.lunch`, `plan.dinner`, `plan.addMeal`, `plan.pickRecipe`, `plan.forPeople`, `plan.addWeekToList`, `plan.addedMeals`, `plan.empty`, `plan.remove`.

- [ ] **Step 1: Add EN keys**

In `src/lib/i18n.ts`, in the `EN` object add `'nav.plan': 'Plan',` next to the other `nav.*` keys, and add this block (place after the `shop.*` block or anywhere inside `EN`):
```ts
  // meal planner
  'plan.title': 'Meal Plan',
  'plan.roomTitle': '{room} — Meal Plan',
  'plan.thisWeek': 'This week',
  'plan.prevWeek': 'Previous week',
  'plan.nextWeek': 'Next week',
  'plan.breakfast': 'Breakfast',
  'plan.lunch': 'Lunch',
  'plan.dinner': 'Dinner',
  'plan.addMeal': 'Add',
  'plan.pickRecipe': 'Pick a recipe',
  'plan.forPeople': 'For how many people',
  'plan.addWeekToList': 'Add this week to shopping list',
  'plan.addedMeals': '{n} meals added to your shopping list',
  'plan.empty': 'Nothing planned yet. Tap “Add” to plan a meal.',
  'plan.remove': 'Remove',
```

- [ ] **Step 2: Add ZH keys**

In the `ZH` object add `'nav.plan': '计划',` and:
```ts
  // meal planner
  'plan.title': '膳食计划',
  'plan.roomTitle': '{room} — 膳食计划',
  'plan.thisWeek': '本周',
  'plan.prevWeek': '上一周',
  'plan.nextWeek': '下一周',
  'plan.breakfast': '早餐',
  'plan.lunch': '午餐',
  'plan.dinner': '晚餐',
  'plan.addMeal': '添加',
  'plan.pickRecipe': '选择食谱',
  'plan.forPeople': '几人份',
  'plan.addWeekToList': '把本周加入购物清单',
  'plan.addedMeals': '已将 {n} 餐加入购物清单',
  'plan.empty': '本周还没有计划。点击“添加”来安排一餐。',
  'plan.remove': '移除',
```

- [ ] **Step 3: Add the Plan link to `nav-links.tsx`**

In `src/components/nav-links.tsx`, compute `const planHref = roomId ? `/rooms/${roomId}/plan` : '/plan'` next to the other hrefs, and add a button after the Recipes button:
```tsx
      <Button asChild variant="ghost" size="sm"><Link href={planHref}>{t('nav.plan')}</Link></Button>
```

- [ ] **Step 4: Add the Plan link to `mobile-menu.tsx`**

In `src/components/mobile-menu.tsx`, compute `const planHref = roomId ? `/rooms/${roomId}/plan` : '/plan'` next to the other hrefs, and add after the Recipes link:
```tsx
            <Link href={planHref} onClick={close} className={item}>{t('nav.plan')}</Link>
```

- [ ] **Step 5: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/i18n.ts src/components/nav-links.tsx src/components/mobile-menu.tsx
git commit -m "feat(plan): i18n strings + Plan nav link"
```

---

### Task 6: AddMealDialog component

**Files:**
- Create: `src/components/add-meal-dialog.tsx`

**Interfaces:**
- Consumes: `addPlanEntryAction` (Task 4); `Recipe` from `@/lib/db-types`; `MealSlot` from `@/lib/plan/week`; `ui/dialog`, `ui/button`, `ui/input`.
- Produces: `<AddMealDialog planDate slot recipes roomId />`.

- [ ] **Step 1: Write `src/components/add-meal-dialog.tsx`**

```tsx
'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { addPlanEntryAction } from '@/app/plan/actions'
import type { Recipe } from '@/lib/db-types'
import type { MealSlot } from '@/lib/plan/week'
import { useT } from '@/components/i18n-provider'

export function AddMealDialog({
  planDate, slot, recipes, roomId,
}: {
  planDate: string
  slot: MealSlot
  recipes: Recipe[]
  roomId: string | null
}) {
  const t = useT()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<Recipe | null>(null)
  const [servings, setServings] = useState(1)
  const [pending, start] = useTransition()

  const filtered = recipes.filter((r) => r.title.toLowerCase().includes(q.toLowerCase()))
  function reset() { setQ(''); setSelected(null); setServings(1) }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-full justify-start text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Plus className="size-3.5" /> {t('plan.addMeal')}
      </Button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset() }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('plan.pickRecipe')}</DialogTitle></DialogHeader>
          {!selected ? (
            <div className="flex flex-col gap-2">
              <Input autoFocus placeholder={t('common.search')} value={q} onChange={(e) => setQ(e.target.value)} />
              <div className="max-h-64 overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">{t('home.noRecipes')}</p>
                ) : (
                  filtered.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => { setSelected(r); setServings(r.servings) }}
                      className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      {r.title}
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="font-medium">{selected.title}</p>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">{t('plan.forPeople')}</span>
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setServings((v) => Math.max(1, v - 1))}>–</Button>
                <span className="w-6 text-center font-semibold">{servings}</span>
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setServings((v) => v + 1)}>＋</Button>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelected(null)}>{t('common.back')}</Button>
                <Button
                  disabled={pending}
                  onClick={() => start(async () => {
                    const res = await addPlanEntryAction({ recipeId: selected.id, planDate, slot, servings, roomId })
                    if (res.error) { toast.error(res.error); return }
                    setOpen(false); reset(); router.refresh()
                  })}
                >
                  {t('common.add')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/add-meal-dialog.tsx
git commit -m "feat(plan): AddMealDialog recipe picker"
```

---

### Task 7: PlannedMeal component (edit servings / remove)

**Files:**
- Create: `src/components/planned-meal.tsx`

**Interfaces:**
- Consumes: `updatePlanServingsAction`, `removePlanEntryAction` (Task 4); `MealPlanEntryView` from `@/lib/db-types`.
- Produces: `<PlannedMeal entry={MealPlanEntryView} />`.

- [ ] **Step 1: Write `src/components/planned-meal.tsx`**

```tsx
'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { updatePlanServingsAction, removePlanEntryAction } from '@/app/plan/actions'
import type { MealPlanEntryView } from '@/lib/db-types'
import { useT } from '@/components/i18n-provider'

export function PlannedMeal({ entry }: { entry: MealPlanEntryView }) {
  const t = useT()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [servings, setServings] = useState(entry.servings)
  const [pending, start] = useTransition()

  return (
    <>
      <button
        type="button"
        onClick={() => { setServings(entry.servings); setOpen(true) }}
        className="flex w-full items-center justify-between gap-1 rounded-md bg-background px-2 py-1 text-left text-sm hover:bg-muted"
      >
        <span className="truncate">{entry.recipe_title}</span>
        <span className="shrink-0 text-muted-foreground">× {entry.servings}</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{entry.recipe_title}</DialogTitle></DialogHeader>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{t('plan.forPeople')}</span>
            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setServings((v) => Math.max(1, v - 1))}>–</Button>
            <span className="w-6 text-center font-semibold">{servings}</span>
            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setServings((v) => v + 1)}>＋</Button>
          </div>
          <div className="flex justify-between gap-2">
            <Button
              variant="ghost"
              className="text-destructive"
              disabled={pending}
              onClick={() => start(async () => { await removePlanEntryAction(entry.id); setOpen(false); router.refresh() })}
            >
              {t('plan.remove')}
            </Button>
            <Button
              disabled={pending}
              onClick={() => start(async () => {
                const res = await updatePlanServingsAction(entry.id, servings)
                if (res.error) { toast.error(res.error); return }
                setOpen(false); router.refresh()
              })}
            >
              {t('common.save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/planned-meal.tsx
git commit -m "feat(plan): PlannedMeal edit/remove chip"
```

---

### Task 8: WeekPlanner component

**Files:**
- Create: `src/components/week-planner.tsx`

**Interfaces:**
- Consumes: `AddMealDialog` (Task 6), `PlannedMeal` (Task 7), `addWeekToShoppingListAction` (Task 4); helpers from `@/lib/plan/week`; `Recipe`, `MealPlanEntryView`.
- Produces: `<WeekPlanner weekStartISO entries recipes roomId />`.

- [ ] **Step 1: Write `src/components/week-planner.tsx`**

```tsx
'use client'
import Link from 'next/link'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AddMealDialog } from '@/components/add-meal-dialog'
import { PlannedMeal } from '@/components/planned-meal'
import {
  weekDays, fromISODate, toISODate, addWeeks, startOfWeek,
  groupEntriesByDayAndSlot, MEAL_SLOTS, type MealSlot,
} from '@/lib/plan/week'
import { addWeekToShoppingListAction } from '@/app/plan/actions'
import type { Recipe, MealPlanEntryView } from '@/lib/db-types'
import { useT } from '@/components/i18n-provider'

export function WeekPlanner({
  weekStartISO, entries, recipes, roomId,
}: {
  weekStartISO: string
  entries: MealPlanEntryView[]
  recipes: Recipe[]
  roomId: string | null
}) {
  const t = useT()
  const router = useRouter()
  const [pending, start] = useTransition()
  const base = roomId ? `/rooms/${roomId}/plan` : '/plan'
  const weekStart = fromISODate(weekStartISO)
  const days = weekDays(weekStart)
  const grouped = groupEntriesByDayAndSlot(entries)
  const prev = toISODate(addWeeks(weekStart, -1))
  const next = toISODate(addWeeks(weekStart, 1))
  const thisWeek = toISODate(startOfWeek(new Date()))
  const slotLabel: Record<MealSlot, string> = {
    breakfast: t('plan.breakfast'), lunch: t('plan.lunch'), dinner: t('plan.dinner'),
  }
  const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button asChild variant="outline" size="icon" className="h-8 w-8" aria-label={t('plan.prevWeek')}>
            <Link href={`${base}?week=${prev}`}><ChevronLeft className="size-4" /></Link>
          </Button>
          <Button asChild variant="outline" size="sm"><Link href={`${base}?week=${thisWeek}`}>{t('plan.thisWeek')}</Link></Button>
          <Button asChild variant="outline" size="icon" className="h-8 w-8" aria-label={t('plan.nextWeek')}>
            <Link href={`${base}?week=${next}`}><ChevronRight className="size-4" /></Link>
          </Button>
        </div>
        <Button
          disabled={pending || entries.length === 0}
          onClick={() => start(async () => {
            const res = await addWeekToShoppingListAction(weekStartISO, roomId)
            toast.success(t('plan.addedMeals', { n: res.meals }))
            router.push(roomId ? `/rooms/${roomId}/shopping-list` : '/shopping-list')
          })}
        >
          {t('plan.addWeekToList')}
        </Button>
      </div>

      <div className="grid gap-3">
        {days.map((d) => {
          const iso = toISODate(d)
          const day = grouped[iso] ?? { breakfast: [], lunch: [], dinner: [] }
          return (
            <div key={iso} className="rounded-xl border bg-card p-3">
              <p className="mb-2 font-serif text-sm font-semibold text-primary">{dayFmt.format(d)}</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {MEAL_SLOTS.map((slot) => (
                  <div key={slot} className="rounded-lg bg-muted/40 p-2">
                    <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">{slotLabel[slot]}</p>
                    <div className="flex flex-col gap-1">
                      {day[slot].map((e) => <PlannedMeal key={e.id} entry={e} />)}
                      <AddMealDialog planDate={iso} slot={slot} recipes={recipes} roomId={roomId} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/week-planner.tsx
git commit -m "feat(plan): WeekPlanner grid"
```

---

### Task 9: Pages (personal + room)

**Files:**
- Create: `src/app/plan/page.tsx`
- Create: `src/app/rooms/[roomId]/plan/page.tsx`

**Interfaces:**
- Consumes: `getWeekPlan` (Task 3), `listRecipes` (`@/lib/data/recipes`), `getRoom` (`@/lib/data/rooms`), helpers from `@/lib/plan/week`, `WeekPlanner` (Task 8), `AppNav`, `getT`.

- [ ] **Step 1: Write `src/app/plan/page.tsx`**

```tsx
import { AppNav } from '@/components/app-nav'
import { WeekPlanner } from '@/components/week-planner'
import { getWeekPlan } from '@/lib/data/meal-plan'
import { listRecipes } from '@/lib/data/recipes'
import { startOfWeek, fromISODate, toISODate } from '@/lib/plan/week'
import { getT } from '@/lib/i18n-server'

const ISO = /^\d{4}-\d{2}-\d{2}$/

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const { week } = await searchParams
  const weekStartISO = toISODate(startOfWeek(week && ISO.test(week) ? fromISODate(week) : new Date()))
  const [entries, recipes, t] = await Promise.all([getWeekPlan(weekStartISO), listRecipes(), getT()])
  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="mb-4 font-serif text-2xl text-primary">{t('plan.title')}</h1>
        <WeekPlanner weekStartISO={weekStartISO} entries={entries} recipes={recipes} roomId={null} />
      </main>
    </>
  )
}
```

- [ ] **Step 2: Write `src/app/rooms/[roomId]/plan/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import { AppNav } from '@/components/app-nav'
import { WeekPlanner } from '@/components/week-planner'
import { getRoom } from '@/lib/data/rooms'
import { getWeekPlan } from '@/lib/data/meal-plan'
import { listRecipes } from '@/lib/data/recipes'
import { startOfWeek, fromISODate, toISODate } from '@/lib/plan/week'
import { getT } from '@/lib/i18n-server'

const ISO = /^\d{4}-\d{2}-\d{2}$/

export default async function RoomPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomId: string }>
  searchParams: Promise<{ week?: string }>
}) {
  const { roomId } = await params
  const { week } = await searchParams
  const weekStartISO = toISODate(startOfWeek(week && ISO.test(week) ? fromISODate(week) : new Date()))
  const [room, entries, recipes, t] = await Promise.all([
    getRoom(roomId), getWeekPlan(weekStartISO, roomId), listRecipes(roomId), getT(),
  ])
  if (!room) notFound()
  return (
    <>
      <AppNav roomId={roomId} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="mb-4 font-serif text-2xl text-primary">{t('plan.roomTitle', { room: room.name })}</h1>
        <WeekPlanner weekStartISO={weekStartISO} entries={entries} recipes={recipes} roomId={roomId} />
      </main>
    </>
  )
}
```

- [ ] **Step 3: Confirm `getRoom` exists**

Run: `grep -n "export async function getRoom" src/lib/data/rooms.ts`
Expected: one match. (If the name differs, adjust the import to the actual room-fetch function used by `src/app/rooms/[roomId]/shopping-list/page.tsx`.)

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: compiles; `/plan` and `/rooms/[roomId]/plan` appear in the route list; no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/plan/page.tsx src/app/rooms/[roomId]/plan/page.tsx
git commit -m "feat(plan): personal + room planner pages"
```

---

### Task 10: README + full verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document the feature in `README.md`**

Add a "Meal planner" sentence to the "What it is" section and add a smoke-checklist item:
```markdown
- [ ] **Plan a week.** Open "Plan", add a recipe to Monday Dinner (set servings), add another to Tuesday Lunch, then click "Add this week to shopping list" → the shopping list shows the combined, aisle-grouped ingredients scaled to the servings you set.
```
Also note in the migrations section that there is now an additional migration (`20260630190000_meal_plan.sql`) applied by `npx supabase db push`.

- [ ] **Step 2: Run the full test suite**

Run: `npm run test:run`
Expected: PASS (existing tests + new week tests).

- [ ] **Step 3: Run lint + build**

Run: `npm run lint && npm run build`
Expected: no lint errors; build succeeds.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs(plan): document meal planner + smoke step"
```

---

## Post-implementation (owner action)

After merge, the owner must apply the new migration to hosted Supabase:
```bash
npx supabase db push
```
Then run the new smoke-checklist item.

## Self-Review

**Spec coverage:**
- Weekly grid (7×3) → Task 8. Add recipe + servings → Task 6. Edit servings / remove → Task 7. Week nav → Task 8. Add-week-to-shopping-list → Tasks 3/4/8. Dual scope (personal + room) → Tasks 2 (RLS), 3 (roomId), 9 (two pages). Nav link → Task 5. i18n EN+ZH → Task 5. Migration → Task 2. Unit tests → Task 1. README/smoke → Task 10. ✅ All sections covered.
- **Placeholder scan:** No TBD/TODO; every code step shows complete code. ✅
- **Type consistency:** `MealSlot` defined once in `lib/plan/week.ts`, imported by `db-types.ts`, data layer, actions, components. `getWeekPlan(weekStartISO, roomId)`, `addPlanEntry({recipeId,planDate,slot,servings,roomId})`, `addWeekToShoppingListAction(weekStartISO, roomId) => {meals}`, `MealPlanEntryView.recipe_title` used consistently across Tasks 3/4/6/7/8/9. ✅
- One assumption flagged inline (Task 9 Step 3): the room-fetch function is named `getRoom`; verified by grep, with a fallback note.
