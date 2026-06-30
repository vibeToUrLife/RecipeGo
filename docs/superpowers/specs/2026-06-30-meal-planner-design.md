# Weekly Meal Planner — Design Spec

**Date:** 2026-06-30
**Status:** Approved (design), ready for implementation plan
**Feature:** A weekly meal planner that lets a user place recipes into Breakfast / Lunch / Dinner slots across a week, set servings per meal, and push the whole week's ingredients into the existing shopping list.

---

## 1. Goal & user story

> As a cook, I want to plan which recipes I'll make on each day of the week (breakfast, lunch, dinner), choose how many people each meal is for, and then build my shopping list for the whole week in one tap.

The planner is the feature that ties RecipeGo's existing pieces together: it consumes **recipes**, reuses the **serving scaler**, and feeds the **shopping list** (merge + aisle grouping).

## 2. Scope

**In scope**
- A weekly grid view: 7 days (Mon–Sun) × 3 slots (Breakfast, Lunch, Dinner).
- Add a recipe to a slot, with a servings number (defaults to the recipe's own `servings`, editable).
- More than one recipe is allowed per slot (a slot is a list, not a single value).
- Edit a planned meal's servings; remove a planned meal.
- Navigate weeks: previous / this week / next.
- "Add this week to shopping list" — pushes every planned meal in the visible week into the shopping list, scaled to its servings, reusing the existing merge + aisle grouping.
- Dual scope: **personal** (`/plan`) and **per Room** (`/rooms/[roomId]/plan`), matching the rest of the app, with the same RLS pattern.
- "Plan" link added to desktop nav and mobile menu (context-aware: personal vs room).
- i18n: all new strings added to `en` and `zh`.
- Unit tests (Vitest) for the pure week/date + grouping logic.

**Out of scope (YAGNI for now)**
- Drag-and-drop between slots (use add/remove instead).
- Copying a week / templates / repeating meals.
- Auto-suggesting meals.
- A calendar month view.
- Notifications / reminders.

## 3. Data model

New table `meal_plan_entries`, following the **dual-scope** pattern used by `recipes` and `shopping_list_items` (`room_id is null` = personal owned by `user_id`; `room_id is not null` = shared, governed by room membership).

```sql
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
create index meal_plan_entries_scope_date_idx
  on public.meal_plan_entries (room_id, plan_date);
create index meal_plan_entries_recipe_id_idx
  on public.meal_plan_entries (recipe_id);
```

Notes:
- No unique constraint on (scope, date, slot) — multiple recipes per slot are allowed.
- `on delete cascade` on `recipe_id`: deleting a recipe removes its planned entries (correct — a plan can't point at a recipe that no longer exists).
- `on delete cascade` on `room_id`: deleting a room clears that room's plan.

### RLS (mirrors `shopping_list_items`)

```sql
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

Migration file: `supabase/migrations/20260630190000_meal_plan.sql` (timestamp after the latest existing migration).

## 4. Modules & boundaries

### 4.1 Pure logic — `src/lib/plan/week.ts` (unit-tested, no I/O)
- `startOfWeek(date: Date): Date` — Monday 00:00 of the week containing `date`.
- `weekDays(weekStart: Date): Date[]` — the 7 `Date`s Mon→Sun.
- `addWeeks(weekStart: Date, n: number): Date` — shift by whole weeks.
- `toISODate(date: Date): string` / `fromISODate(s: string): Date` — `YYYY-MM-DD` round-trip in local time (no timezone drift).
- `MEAL_SLOTS = ['breakfast','lunch','dinner'] as const`; `type MealSlot`.
- `groupEntriesByDayAndSlot(entries)` → a structure keyed by `plan_date` then `meal_slot`, for rendering the grid.

### 4.2 Types — `src/lib/db-types.ts`
```ts
export type MealSlot = 'breakfast' | 'lunch' | 'dinner'
export interface MealPlanEntry {
  id: string; user_id: string; room_id: string | null;
  recipe_id: string; plan_date: string; meal_slot: MealSlot;
  servings: number; created_at: string;
}
// Entry joined with the bits the grid needs to render:
export interface MealPlanEntryView extends MealPlanEntry {
  recipe_title: string;
}
```

### 4.3 Data layer — `src/lib/data/meal-plan.ts` (`server-only`)
Signatures mirror existing data modules (`roomId: string | null = null`):
- `getWeekPlan(weekStartISO: string, roomId = null): Promise<MealPlanEntryView[]>`
  — select entries where `plan_date` in the 7-day range and scope matches; join recipe titles (select `recipe_id, recipes(title)` or a second query keyed by recipe id, matching the style in `listRecipesWithIngredients`).
- `addPlanEntry(input: { recipeId; planDate; slot; servings; roomId }): Promise<void>`
- `updatePlanServings(id: string, servings: number): Promise<void>`
- `removePlanEntry(id: string): Promise<void>`
- `addWeekToShoppingList(weekStartISO: string, roomId = null): Promise<{ meals: number }>`
  — load the week's entries, then for each call the existing `addRecipeToList(recipe_id, servings)` (sequentially, because it does read-merge-write on the shared list). Returns the count of meals added.

### 4.4 Server actions — `src/app/plan/actions.ts` (`'use server'`)
Thin wrappers that validate input, call the data layer, and `revalidatePath('/', 'layout')`. Same shape as `shopping-list/actions.ts`:
- `addPlanEntryAction(input)` — validates slot ∈ MEAL_SLOTS, servings 1–1000, planDate matches `YYYY-MM-DD`.
- `updatePlanServingsAction(id, servings)`
- `removePlanEntryAction(id)`
- `addWeekToShoppingListAction(weekStartISO, roomId)` → returns `{ meals }`.

### 4.5 Pages
- `src/app/plan/page.tsx` — personal. Reads `?week=YYYY-MM-DD` (defaults to current week via `startOfWeek`), loads `getWeekPlan(weekStartISO)` and the user's recipe list for the picker (`listRecipes()`), renders `<AppNav/>` + `<WeekPlanner/>`.
- `src/app/rooms/[roomId]/plan/page.tsx` — same, room-scoped: `getRoom(roomId)` (404 if missing), `getWeekPlan(weekStartISO, roomId)`, `listRecipes(roomId)`, `<AppNav roomId={roomId}/>`.

### 4.6 Components
- `src/components/week-planner.tsx` (`'use client'`) — the grid. Props: `weekStartISO`, `entries: MealPlanEntryView[]`, `recipes: Recipe[]` (for the picker), `roomId`. Renders day rows × 3 slots; week nav links (`/plan?week=…` or room equivalent); an "Add this week to shopping list" button (uses a transition + `sonner` toast like `add-to-list-button.tsx`). Responsive: 7-column-ish on desktop, stacked day cards on mobile.
- `src/components/add-meal-dialog.tsx` (`'use client'`) — opened from a slot's "+ add". Uses the existing `ui/dialog`. Searchable recipe list (filter by title like `recipe-library.tsx`), a servings stepper (reuse `ServingsStepper` pattern) pre-filled with the chosen recipe's `servings`, Save calls `addPlanEntryAction`.
- A planned-meal chip (inline in `week-planner.tsx` or a small `planned-meal.tsx`): shows title + "× N", tap to edit servings / remove.

### 4.7 Nav
- `src/components/nav-links.tsx`: add a "Plan" link → `roomId ? /rooms/${roomId}/plan : /plan`.
- `src/components/mobile-menu.tsx`: add the same link.

### 4.8 i18n — `src/lib/i18n.ts`
Add keys (EN + ZH): `nav.plan`; `plan.title`, `plan.roomTitle`, `plan.thisWeek`, `plan.prevWeek`, `plan.nextWeek`, `plan.breakfast`, `plan.lunch`, `plan.dinner`, `plan.addMeal`, `plan.pickRecipe`, `plan.forPeople`, `plan.addWeekToList`, `plan.addedMeals` (`{n} meals added to your shopping list`), `plan.empty`, `plan.remove`.

## 5. Data flow

1. Page (server) computes `weekStart` from `?week` (or today), loads entries + recipes, passes to `<WeekPlanner/>`.
2. User taps "+ add" on a slot → `<AddMealDialog/>` → pick recipe + servings → `addPlanEntryAction` → DB insert → `revalidatePath` re-renders the grid.
3. User taps a planned chip → edit servings (`updatePlanServingsAction`) or remove (`removePlanEntryAction`).
4. Week nav → link changes `?week`, server reloads that week.
5. "Add this week to shopping list" → `addWeekToShoppingListAction` → loops `addRecipeToList` per entry → toast `plan.addedMeals` → optionally route to the shopping list.

## 6. Error handling
- Server actions validate slot, servings range, and date format; invalid → thrown/returned error, surfaced via `sonner` toast (matching existing components).
- Room pages `notFound()` when the room isn't accessible (RLS makes `getRoom` return null).
- RLS is the security backstop: a forged `room_id`/`recipe_id` the user can't access fails the policy.
- Empty week → friendly `plan.empty` message; "Add this week to shopping list" is disabled when there are no entries.

## 7. Testing
- **Vitest (no DB), `src/lib/plan/__tests__/week.test.ts`:** `startOfWeek` (incl. Sunday & Monday edge cases, month boundaries), `weekDays` length/order, `addWeeks`, `toISODate`/`fromISODate` round-trip with no off-by-one, `groupEntriesByDayAndSlot` buckets entries correctly and keeps multiple-per-slot.
- Existing `npm run test:run` must stay green.
- Manual smoke (added to README checklist): plan two recipes on two days, set different servings, add week to shopping list → list shows merged, aisle-grouped, correctly scaled items.

## 8. Defaults chosen
- **Week starts Monday.** (Changeable later if desired.)
- **Multiple recipes per slot allowed.**
- **Servings default** = the recipe's saved `servings`, editable per meal.

## 9. Files touched (summary)
- New: migration `20260630190000_meal_plan.sql`; `src/lib/plan/week.ts`; `src/lib/data/meal-plan.ts`; `src/app/plan/page.tsx`; `src/app/plan/actions.ts`; `src/app/rooms/[roomId]/plan/page.tsx`; `src/components/week-planner.tsx`; `src/components/add-meal-dialog.tsx`; tests.
- Edited: `src/lib/db-types.ts`; `src/components/nav-links.tsx`; `src/components/mobile-menu.tsx`; `src/lib/i18n.ts`; `README.md` (feature + smoke step).
