# RecipeGo Rooms (Shared Cookbooks) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add shared "Rooms" so users can create a shared cookbook, invite others by email, and equally add/edit/delete its recipes and share one per-room shopping list — while existing personal recipes stay private.

**Architecture:** Recipes and shopping-list items gain a nullable `room_id`. RLS is rewritten so personal rows (`room_id is null`) are owner-only and room rows are visible/editable by any member, with membership checked through `SECURITY DEFINER` helper functions (`is_room_member`, `is_room_owner`, `can_access_recipe`) to avoid policy recursion. New tables `rooms`, `room_members`, `room_invites` carry collaboration. UI gains a context switcher (Personal / each Room), room pages, a recipe "Collection" selector, and room-scoped shopping.

**Tech Stack:** Next.js 16 (App Router, src-dir, TS strict), Supabase (Postgres + Auth + Storage) via `@supabase/ssr`, Tailwind v4, shadcn/Base-UI, Vitest.

## Global Constraints

- Reference the design spec verbatim: `docs/superpowers/specs/2026-06-28-recipego-rooms-design.md`.
- **Owner-only invites/membership management.** Room members are otherwise equal: any member can add/edit/delete any recipe in the room and use the room's shared shopping list.
- A recipe is in exactly one place: Personal (`room_id is null`, owner = `user_id`) **or** one room (`room_id` set). `user_id`/`shopping_list_items.user_id` remain "added by".
- RLS is the security boundary, never the UI. Room reads/writes go through the user's RLS-scoped server client — **never** the `service_role` admin client.
- All `SECURITY DEFINER` functions set `search_path = ''` and fully-qualify object names.
- Backward compatible: existing rows keep `room_id = null` and stay personal/reachable.
- Supabase client usage: `await createClient()` (async server client from `@/utils/supabase/server`); `getUser()` not `getSession()` server-side.
- Existing 63 Vitest tests must stay green. Every task ends `tsc --noEmit` + `npm run build` clean.
- DB changes ship as a numbered migration in `supabase/migrations/` **and** are folded into `supabase/setup_all.sql`. The owner applies them via the Supabase SQL Editor.
- Routing: `/rooms`, `/rooms/[roomId]`, `/rooms/[roomId]/members`, `/rooms/[roomId]/shopping-list`. Existing `/`, `/shopping-list`, `/recipes/*` are made room-aware.

## Shared interfaces (defined here, used across tasks)

```ts
// src/lib/db-types.ts (added in Task 1)
export interface Room { id: string; name: string; owner_id: string; created_at: string }
export interface RoomMember { room_id: string; user_id: string; role: 'owner' | 'member'; joined_at: string }
export interface RoomInvite { id: string; room_id: string; email: string; invited_by: string; status: 'pending' | 'accepted' | 'declined'; created_at: string }
export interface MemberWithName extends RoomMember { display_name: string | null }
export interface PendingInvite extends RoomInvite { room_name: string }
```

Recipe/shopping types gain `room_id: string | null` (Task 1). Data-layer signatures (Task 2 / Task 8):

```ts
// src/lib/data/rooms.ts
listMyRooms(): Promise<Room[]>
getRoom(id: string): Promise<Room | null>
createRoom(name: string): Promise<string>            // returns new room id
renameRoom(id: string, name: string): Promise<void>
deleteRoom(id: string): Promise<void>
listMembers(roomId: string): Promise<MemberWithName[]>
removeMember(roomId: string, userId: string): Promise<void>
leaveRoom(roomId: string): Promise<void>
inviteToRoom(roomId: string, email: string): Promise<void>
listRoomInvites(roomId: string): Promise<RoomInvite[]>      // pending, owner view
listMyPendingInvites(): Promise<PendingInvite[]>
acceptInvite(inviteId: string): Promise<void>              // rpc accept_room_invite
declineInvite(inviteId: string): Promise<void>

// src/lib/data/recipes.ts  (modified)
listRecipes(roomId?: string | null): Promise<Recipe[]>     // default null = personal
// createRecipe/updateRecipe RecipeFormData gains room_id: string | null

// src/lib/data/shopping.ts  (modified)
getShoppingList(roomId?: string | null): Promise<ShoppingListRow[]>
addRecipeToList(recipeId: string, servings: number): Promise<void>   // derives room from recipe
clearChecked(roomId?: string | null): Promise<void>
```

---

## Phase 1 — Rooms plumbing

### Task 1: Database migration + types

**Files:**
- Create: `supabase/migrations/20260628220000_rooms.sql`
- Modify: `supabase/setup_all.sql` (fold in the same DDL)
- Modify: `src/lib/db-types.ts` (add Room/RoomMember/RoomInvite/MemberWithName/PendingInvite; add `room_id` to `Recipe`, `RecipeFormData`, and shopping row)

**Interfaces:**
- Produces: the 3 tables, `room_id` columns, functions `public.is_room_member(uuid)`, `public.is_room_owner(uuid)`, `public.can_access_recipe(uuid)`, `public.accept_room_invite(uuid)`, trigger `on_room_created`, and the rewritten RLS. Produces the TS types above.

- [ ] **Step 1: Write the migration SQL** — `supabase/migrations/20260628220000_rooms.sql`:

```sql
-- ============ ROOMS ============
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index room_members_user_id_idx on public.room_members (user_id);
create table public.room_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  email text not null,
  invited_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  unique (room_id, email)
);
create index room_invites_email_idx on public.room_invites (lower(email));

-- ============ room_id on existing tables ============
alter table public.recipes add column room_id uuid references public.rooms(id) on delete cascade;
create index recipes_room_id_idx on public.recipes (room_id);
alter table public.shopping_list_items add column room_id uuid references public.rooms(id) on delete cascade;
create index shopping_list_items_room_id_idx on public.shopping_list_items (room_id);

-- ============ membership helper functions (SECURITY DEFINER, no RLS recursion) ============
create or replace function public.is_room_member(p_room uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (select 1 from public.room_members m
                 where m.room_id = p_room and m.user_id = (select auth.uid()));
$$;
create or replace function public.is_room_owner(p_room uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (select 1 from public.rooms r
                 where r.id = p_room and r.owner_id = (select auth.uid()));
$$;
create or replace function public.can_access_recipe(p_recipe uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.recipes r
    where r.id = p_recipe
      and ( (r.room_id is null and r.user_id = (select auth.uid()))
            or (r.room_id is not null and public.is_room_member(r.room_id)) ));
$$;

-- ============ auto-add owner as member ============
create or replace function public.handle_new_room()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.room_members (room_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end; $$;
create trigger on_room_created after insert on public.rooms
  for each row execute procedure public.handle_new_room();

-- ============ accept invite ============
create or replace function public.accept_room_invite(p_invite uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_room uuid; v_email text;
begin
  select room_id, email into v_room, v_email
  from public.room_invites where id = p_invite and status = 'pending';
  if v_room is null then raise exception 'invite not found or already handled'; end if;
  if lower(v_email) <> lower((select auth.email())) then raise exception 'invite is not for you'; end if;
  insert into public.room_members (room_id, user_id, role)
  values (v_room, (select auth.uid()), 'member')
  on conflict (room_id, user_id) do nothing;
  update public.room_invites set status = 'accepted' where id = p_invite;
end; $$;

-- ============ my pending invites (with room name; invitee is not yet a member, so
-- they cannot read public.rooms via RLS — this definer function exposes just the name) ============
create or replace function public.my_pending_invites()
returns table (id uuid, room_id uuid, room_name text, created_at timestamptz)
language sql security definer stable set search_path = '' as $$
  select i.id, i.room_id, r.name, i.created_at
  from public.room_invites i join public.rooms r on r.id = i.room_id
  where i.status = 'pending' and lower(i.email) = lower((select auth.email()));
$$;

-- ============ RLS: new tables ============
alter table public.rooms enable row level security;
create policy "rooms select" on public.rooms for select to authenticated using ( public.is_room_member(id) );
create policy "rooms insert" on public.rooms for insert to authenticated with check ( owner_id = (select auth.uid()) );
create policy "rooms update" on public.rooms for update to authenticated using ( public.is_room_owner(id) ) with check ( public.is_room_owner(id) );
create policy "rooms delete" on public.rooms for delete to authenticated using ( public.is_room_owner(id) );

alter table public.room_members enable row level security;
create policy "members select" on public.room_members for select to authenticated using ( public.is_room_member(room_id) );
create policy "members insert" on public.room_members for insert to authenticated with check ( public.is_room_owner(room_id) );
create policy "members delete" on public.room_members for delete to authenticated using ( public.is_room_owner(room_id) or user_id = (select auth.uid()) );

alter table public.room_invites enable row level security;
create policy "invites select" on public.room_invites for select to authenticated using ( public.is_room_member(room_id) or lower(email) = lower((select auth.email())) );
create policy "invites insert" on public.room_invites for insert to authenticated with check ( public.is_room_owner(room_id) );
create policy "invites update" on public.room_invites for update to authenticated using ( lower(email) = lower((select auth.email())) ) with check ( lower(email) = lower((select auth.email())) );
create policy "invites delete" on public.room_invites for delete to authenticated using ( public.is_room_owner(room_id) );

-- ============ RLS: rewrite recipes / ingredients / steps / shopping ============
drop policy "select own recipes" on public.recipes;
drop policy "insert own recipes" on public.recipes;
drop policy "update own recipes" on public.recipes;
drop policy "delete own recipes" on public.recipes;
create policy "recipes select" on public.recipes for select to authenticated
  using ( (room_id is null and user_id = (select auth.uid())) or (room_id is not null and public.is_room_member(room_id)) );
create policy "recipes insert" on public.recipes for insert to authenticated
  with check ( (room_id is null and user_id = (select auth.uid())) or (room_id is not null and public.is_room_member(room_id)) );
create policy "recipes update" on public.recipes for update to authenticated
  using ( (room_id is null and user_id = (select auth.uid())) or (room_id is not null and public.is_room_member(room_id)) )
  with check ( (room_id is null and user_id = (select auth.uid())) or (room_id is not null and public.is_room_member(room_id)) );
create policy "recipes delete" on public.recipes for delete to authenticated
  using ( (room_id is null and user_id = (select auth.uid())) or (room_id is not null and public.is_room_member(room_id)) );

drop policy "select ingredients of own recipes" on public.ingredients;
drop policy "insert ingredients of own recipes" on public.ingredients;
drop policy "update ingredients of own recipes" on public.ingredients;
drop policy "delete ingredients of own recipes" on public.ingredients;
create policy "ingredients select" on public.ingredients for select to authenticated using ( public.can_access_recipe(recipe_id) );
create policy "ingredients insert" on public.ingredients for insert to authenticated with check ( public.can_access_recipe(recipe_id) );
create policy "ingredients update" on public.ingredients for update to authenticated using ( public.can_access_recipe(recipe_id) ) with check ( public.can_access_recipe(recipe_id) );
create policy "ingredients delete" on public.ingredients for delete to authenticated using ( public.can_access_recipe(recipe_id) );

drop policy "select steps of own recipes" on public.steps;
drop policy "insert steps of own recipes" on public.steps;
drop policy "update steps of own recipes" on public.steps;
drop policy "delete steps of own recipes" on public.steps;
create policy "steps select" on public.steps for select to authenticated using ( public.can_access_recipe(recipe_id) );
create policy "steps insert" on public.steps for insert to authenticated with check ( public.can_access_recipe(recipe_id) );
create policy "steps update" on public.steps for update to authenticated using ( public.can_access_recipe(recipe_id) ) with check ( public.can_access_recipe(recipe_id) );
create policy "steps delete" on public.steps for delete to authenticated using ( public.can_access_recipe(recipe_id) );

drop policy "select own list items" on public.shopping_list_items;
drop policy "insert own list items" on public.shopping_list_items;
drop policy "update own list items" on public.shopping_list_items;
drop policy "delete own list items" on public.shopping_list_items;
create policy "list select" on public.shopping_list_items for select to authenticated
  using ( (room_id is null and user_id = (select auth.uid())) or (room_id is not null and public.is_room_member(room_id)) );
create policy "list insert" on public.shopping_list_items for insert to authenticated
  with check ( (room_id is null and user_id = (select auth.uid())) or (room_id is not null and public.is_room_member(room_id)) );
create policy "list update" on public.shopping_list_items for update to authenticated
  using ( (room_id is null and user_id = (select auth.uid())) or (room_id is not null and public.is_room_member(room_id)) )
  with check ( (room_id is null and user_id = (select auth.uid())) or (room_id is not null and public.is_room_member(room_id)) );
create policy "list delete" on public.shopping_list_items for delete to authenticated
  using ( (room_id is null and user_id = (select auth.uid())) or (room_id is not null and public.is_room_member(room_id)) );
```

- [ ] **Step 2: Fold the same DDL into `supabase/setup_all.sql`** — for a fresh install, edit `setup_all.sql` so the rooms tables/functions exist and the recipes/ingredients/steps/shopping policies are the **room-aware** versions from the start (no drop/create needed there — just create the final policies directly), and the create-table statements for `recipes` and `shopping_list_items` include `room_id uuid references public.rooms(id) on delete cascade`. Place the `rooms` tables + helper functions **before** the recipes section so the FK/functions resolve. Keep the file runnable top-to-bottom on a clean project.

- [ ] **Step 3: Add the TS types** — in `src/lib/db-types.ts` add the `Room`, `RoomMember`, `RoomInvite`, `MemberWithName`, `PendingInvite` interfaces (verbatim from "Shared interfaces"); add `room_id: string | null` to `Recipe`; add `room_id: string | null` to `RecipeFormData`; (the shopping row type lives in `src/lib/data/shopping.ts` `ShoppingListRow` — add `room_id: string | null` there in Task 8, not here).

- [ ] **Step 4: Verify** — `npx tsc --noEmit` clean. (No build behavior change yet.) The SQL is validated by review; live application is the owner's step.

- [ ] **Step 5: Commit** — `git add supabase/migrations/20260628220000_rooms.sql supabase/setup_all.sql src/lib/db-types.ts && git commit -m "feat(rooms): schema, helper functions, RLS rewrite, types"`

### Task 2: Rooms data layer + server actions

**Files:**
- Create: `src/lib/data/rooms.ts` (`import 'server-only'`)
- Create: `src/app/rooms/actions.ts` (`'use server'`)
- Create: `src/lib/email.ts` + `src/lib/__tests__/email.test.ts` (pure helper, TDD)

**Interfaces:**
- Consumes: `@/utils/supabase/server` `createClient`; types from `db-types`.
- Produces: the `lib/data/rooms.ts` signatures listed in "Shared interfaces", and server actions `createRoomAction(formData)`, `inviteAction(roomId, formData)`, `acceptInviteAction(id)`, `declineInviteAction(id)`, `removeMemberAction(roomId, userId)`, `leaveRoomAction(roomId)`, `renameRoomAction(roomId, formData)`, `deleteRoomAction(roomId)`.

- [ ] **Step 1: Write failing test** — `src/lib/__tests__/email.test.ts` (`// @vitest-environment node`):

```ts
import { describe, it, expect } from 'vitest'
import { normalizeEmail, isValidEmail } from '@/lib/email'
describe('email', () => {
  it('normalizes case and whitespace', () => {
    expect(normalizeEmail('  Mom@Email.COM ')).toBe('mom@email.com')
  })
  it('validates basic shape', () => {
    expect(isValidEmail('a@b.co')).toBe(true)
    expect(isValidEmail('nope')).toBe(false)
    expect(isValidEmail('')).toBe(false)
  })
})
```

- [ ] **Step 2: Run it — FAIL** — `npm run test:run -- email` → fails (module missing).

- [ ] **Step 3: Implement** `src/lib/email.ts`:

```ts
export function normalizeEmail(raw: string): string { return raw.trim().toLowerCase() }
export function isValidEmail(raw: string): boolean { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim()) }
```

- [ ] **Step 4: Run it — PASS** — `npm run test:run -- email`.

- [ ] **Step 5: Implement `src/lib/data/rooms.ts`** — `import 'server-only'`, using the user's server client. Key bodies:

```ts
import 'server-only'
import { createClient } from '@/utils/supabase/server'
import type { Room, RoomInvite, MemberWithName, PendingInvite } from '@/lib/db-types'
import { normalizeEmail } from '@/lib/email'

export async function listMyRooms(): Promise<Room[]> {
  const s = await createClient()
  const { data, error } = await s.from('rooms').select('*').order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}
export async function getRoom(id: string): Promise<Room | null> {
  const s = await createClient()
  const { data, error } = await s.from('rooms').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data ?? null
}
export async function createRoom(name: string): Promise<string> {
  const s = await createClient()
  const { data, error } = await s.from('rooms').insert({ name }).select('id').single()
  if (error) throw error
  return data.id
}
export async function renameRoom(id: string, name: string): Promise<void> {
  const s = await createClient(); const { error } = await s.from('rooms').update({ name }).eq('id', id); if (error) throw error
}
export async function deleteRoom(id: string): Promise<void> {
  const s = await createClient(); const { error } = await s.from('rooms').delete().eq('id', id); if (error) throw error
}
export async function listMembers(roomId: string): Promise<MemberWithName[]> {
  const s = await createClient()
  const { data, error } = await s.from('room_members').select('*, profiles(display_name)').eq('room_id', roomId)
  if (error) throw error
  return (data ?? []).map((m: any) => ({ room_id: m.room_id, user_id: m.user_id, role: m.role, joined_at: m.joined_at, display_name: m.profiles?.display_name ?? null }))
}
export async function removeMember(roomId: string, userId: string): Promise<void> {
  const s = await createClient(); const { error } = await s.from('room_members').delete().eq('room_id', roomId).eq('user_id', userId); if (error) throw error
}
export async function leaveRoom(roomId: string): Promise<void> {
  const s = await createClient(); const { data: { user } } = await s.auth.getUser()
  const { error } = await s.from('room_members').delete().eq('room_id', roomId).eq('user_id', user!.id); if (error) throw error
}
export async function inviteToRoom(roomId: string, email: string): Promise<void> {
  const s = await createClient()
  const { error } = await s.from('room_invites').upsert({ room_id: roomId, email: normalizeEmail(email), status: 'pending' }, { onConflict: 'room_id,email' })
  if (error) throw error
}
export async function listRoomInvites(roomId: string): Promise<RoomInvite[]> {
  const s = await createClient()
  const { data, error } = await s.from('room_invites').select('*').eq('room_id', roomId).eq('status', 'pending')
  if (error) throw error
  return data ?? []
}
export async function listMyPendingInvites(): Promise<PendingInvite[]> {
  // Uses the SECURITY DEFINER rpc so the room NAME is visible even though the
  // invitee is not yet a member (and thus cannot read public.rooms via RLS).
  const s = await createClient()
  const { data, error } = await s.rpc('my_pending_invites')
  if (error) throw error
  return (data ?? []).map((r: any) => ({ id: r.id, room_id: r.room_id, room_name: r.room_name, email: '', invited_by: '', status: 'pending' as const, created_at: r.created_at }))
}
export async function acceptInvite(inviteId: string): Promise<void> {
  const s = await createClient(); const { error } = await s.rpc('accept_room_invite', { p_invite: inviteId }); if (error) throw error
}
export async function declineInvite(inviteId: string): Promise<void> {
  const s = await createClient(); const { error } = await s.from('room_invites').update({ status: 'declined' }).eq('id', inviteId); if (error) throw error
}
```

Note: `listMyPendingInvites` relies on the `invites select` RLS policy (email match) — RLS returns only the caller's invites, so no extra `.eq('email', …)` is needed (and `auth.email()` isn't a column). The `rooms(name)` embed works because the caller can read those rooms via the invite's room relationship under the `invites select` policy combined with `rooms select`... if the embed returns null room names, fall back to a second `getRoom`-style query keyed by `room_id`.

- [ ] **Step 6: Implement `src/app/rooms/actions.ts`** — thin server actions wrapping the data layer, each `revalidatePath` and/or `redirect` as appropriate. Validate invite email with `isValidEmail`; reject invalid before calling `inviteToRoom`. Example:

```ts
'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import * as rooms from '@/lib/data/rooms'
import { isValidEmail } from '@/lib/email'

export async function createRoomAction(formData: FormData) {
  const name = (formData.get('name') as string)?.trim()
  if (!name) redirect('/rooms?error=' + encodeURIComponent('Room name is required'))
  const id = await rooms.createRoom(name)
  revalidatePath('/rooms'); redirect(`/rooms/${id}`)
}
export async function inviteAction(roomId: string, formData: FormData) {
  const email = (formData.get('email') as string) ?? ''
  if (!isValidEmail(email)) redirect(`/rooms/${roomId}/members?error=` + encodeURIComponent('Enter a valid email'))
  await rooms.inviteToRoom(roomId, email)
  revalidatePath(`/rooms/${roomId}/members`); redirect(`/rooms/${roomId}/members?message=` + encodeURIComponent('Invite sent'))
}
export async function acceptInviteAction(id: string) { await rooms.acceptInvite(id); revalidatePath('/rooms') }
export async function declineInviteAction(id: string) { await rooms.declineInvite(id); revalidatePath('/rooms') }
export async function removeMemberAction(roomId: string, userId: string) { await rooms.removeMember(roomId, userId); revalidatePath(`/rooms/${roomId}/members`) }
export async function leaveRoomAction(roomId: string) { await rooms.leaveRoom(roomId); revalidatePath('/rooms'); redirect('/rooms') }
export async function renameRoomAction(roomId: string, formData: FormData) {
  const name = (formData.get('name') as string)?.trim(); if (name) await rooms.renameRoom(roomId, name); revalidatePath(`/rooms/${roomId}/members`)
}
export async function deleteRoomAction(roomId: string) { await rooms.deleteRoom(roomId); revalidatePath('/rooms'); redirect('/rooms') }
```

- [ ] **Step 7: Verify** — `npm run test:run` (64 tests, +2 email), `npx tsc --noEmit` clean.

- [ ] **Step 8: Commit** — `git add src/lib/data/rooms.ts src/app/rooms/actions.ts src/lib/email.ts src/lib/__tests__/email.test.ts && git commit -m "feat(rooms): data layer + server actions + email helpers"`

### Task 3: `/rooms` page — create, list, pending invites

**Files:**
- Create: `src/app/rooms/page.tsx`
- Create: `src/components/invite-actions.tsx` (`'use client'`, Accept/Decline buttons via `useTransition`)

**Interfaces:**
- Consumes: `listMyRooms`, `listMyPendingInvites` (data layer); `createRoomAction`, `acceptInviteAction`, `declineInviteAction` (actions); `AppNav`.

- [ ] **Step 1: Build `invite-actions.tsx`** — a client component taking `inviteId`, rendering **Accept** and **Decline** buttons that call `acceptInviteAction(inviteId)` / `declineInviteAction(inviteId)` inside `useTransition`, with `toast` feedback and `router.refresh()`.

- [ ] **Step 2: Build `/rooms/page.tsx`** (server component, async): render `<AppNav/>`; a "Create a room" form (`action={createRoomAction}`, `name="name"` input + submit `type="submit"`); show `searchParams.error`/`message` banners (await `searchParams`); list `await listMyRooms()` as links to `/rooms/[id]`; list `await listMyPendingInvites()` each with room_name + `<InviteActions inviteId={i.id}/>`. Use the Warm Editorial styles consistent with existing pages (Card, serif headings).

- [ ] **Step 3: Verify** — `npm run build` compiles `/rooms`; `npx tsc --noEmit` clean. Manual: page reachable when logged in.

- [ ] **Step 4: Commit** — `git add src/app/rooms/page.tsx src/components/invite-actions.tsx && git commit -m "feat(rooms): /rooms page (create, list, accept/decline invites)"`

### Task 4: `/rooms/[roomId]/members` — members + invite (owner)

**Files:**
- Create: `src/app/rooms/[roomId]/members/page.tsx`
- Create: `src/components/member-row.tsx` (`'use client'`, remove/leave buttons with confirm)

**Interfaces:**
- Consumes: `getRoom`, `listMembers`, `listRoomInvites`; `inviteAction`, `removeMemberAction`, `leaveRoomAction`, `renameRoomAction`, `deleteRoomAction`; current user via server client `getUser()`.

- [ ] **Step 1: Build `members/page.tsx`** (async server): load `room = await getRoom(roomId)` (`notFound()` if null); `members = await listMembers(roomId)`; `invites = await listRoomInvites(roomId)`; `const { data:{ user } } = await (await createClient()).auth.getUser()`; `const isOwner = room.owner_id === user?.id`. Render members (name + role), pending invite emails. If `isOwner`: an invite-by-email form (`action={inviteAction.bind(null, roomId)}`, `name="email"`), a rename form, and a destructive **Delete room** button (`action={deleteRoomAction.bind(null, roomId)}`). For non-owners: a **Leave room** button (`action={leaveRoomAction.bind(null, roomId)}`). Show `searchParams.error/message`.

- [ ] **Step 2: Build `member-row.tsx`** — owner sees a **Remove** button per non-owner member (confirm-then-call `removeMemberAction(roomId, userId)` via `useTransition`), styled like `DeleteRecipeButton`'s inline confirm.

- [ ] **Step 3: Verify** — `npm run build` + `tsc` clean.

- [ ] **Step 4: Commit** — `git add src/app/rooms/[roomId]/members/page.tsx src/components/member-row.tsx && git commit -m "feat(rooms): members page + invite/remove/leave/rename/delete"`

---

## Phase 2 — Room-scoped recipes

### Task 5: Context switcher in the top nav

**Files:**
- Modify: `src/components/app-nav.tsx`
- Create: `src/components/room-switcher.tsx` (`'use client'`)

**Interfaces:**
- Consumes: `listMyRooms` (call in `app-nav`, pass rooms to the client switcher).

- [ ] **Step 1: Make `app-nav` async** and fetch `const myRooms = await listMyRooms()`; render `<RoomSwitcher rooms={myRooms} />` in the nav. (Keep existing nav links.)

- [ ] **Step 2: Build `room-switcher.tsx`** — a dropdown (use existing `dropdown-menu.tsx`) labeled by the current context. Items: **My Recipes** → `/`, each room → `/rooms/[id]`, divider, **Manage rooms** → `/rooms`. Determine current selection from `usePathname()` (`/rooms/<id>` → that room; else My Recipes).

- [ ] **Step 3: Verify** — `npm run build` + `tsc` clean; nav shows the switcher on every page using `AppNav`.

- [ ] **Step 4: Commit** — `git add src/components/app-nav.tsx src/components/room-switcher.tsx && git commit -m "feat(rooms): context switcher in top nav"`

### Task 6: Room library page + room-aware `listRecipes`

**Files:**
- Modify: `src/lib/data/recipes.ts` (`listRecipes(roomId?: string | null)`)
- Create: `src/app/rooms/[roomId]/page.tsx`
- Modify: `src/components/recipe-library.tsx` (accept an optional `addHref` and `roomName`/heading; show "added by" when in a room — optional)

**Interfaces:**
- Consumes: `getRoom`, `listRecipes(roomId)`.
- Produces: `listRecipes(roomId?: string | null)` filtering `room_id` (`is null` for personal, `eq` for room).

- [ ] **Step 1: Modify `listRecipes`**:

```ts
export async function listRecipes(roomId: string | null = null): Promise<Recipe[]> {
  const supabase = await createClient()
  let q = supabase.from('recipes').select('*').order('created_at', { ascending: false })
  q = roomId ? q.eq('room_id', roomId) : q.is('room_id', null)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}
```
Update the existing `/` page (`src/app/page.tsx`) call to `listRecipes()` (personal) — confirm it still passes no arg (default null) so `/` shows only personal recipes now.

- [ ] **Step 2: Build `/rooms/[roomId]/page.tsx`** — `room = await getRoom(roomId)` (`notFound()` if null); `recipes = await listRecipes(roomId)`; render `<AppNav/>`, the room name heading, a **Members** link (`/rooms/[id]/members`), a **shared shopping list** link (`/rooms/[id]/shopping-list`), and the recipe grid (reuse `RecipeLibrary` with an `addHref={`/recipes/new?room=${roomId}`}`). 

- [ ] **Step 3: Adjust `recipe-library.tsx`** to accept `addHref?: string` (default `/recipes/new`) for the "Add a recipe" button so it can target a room.

- [ ] **Step 4: Verify** — `npm run build` + `tsc` clean; `/` shows personal only, `/rooms/[id]` shows that room's recipes.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(rooms): room library page + room-aware listRecipes"`

### Task 7: Collection dropdown + room-aware recipe save

**Files:**
- Modify: `src/components/recipe-form.tsx` (Collection `<select name="room_id">`)
- Modify: `src/components/new-recipe-client.tsx` and/or `src/app/recipes/new/page.tsx` (read `?room=` to preselect; pass available rooms to the form)
- Modify: `src/app/recipes/actions.ts` (`parseForm` reads `room_id`; pass through)
- Modify: `src/lib/data/recipes.ts` (`createRecipe`/`updateRecipe` write `room_id`)

**Interfaces:**
- Consumes: `listMyRooms` (to populate the dropdown); `RecipeFormData.room_id`.

- [ ] **Step 1: Pass rooms + default into the form** — the new/edit pages fetch `await listMyRooms()` and pass `rooms` to `RecipeForm`; new page reads `searchParams.room` for the default; edit page defaults to `recipe.room_id`.

- [ ] **Step 2: Add the Collection select to `recipe-form.tsx`**:

```tsx
<div className="space-y-2">
  <Label htmlFor="room_id">Collection</Label>
  <select id="room_id" name="room_id" defaultValue={defaultRoomId ?? ''}
    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
    <option value="">My Recipes (private)</option>
    {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
  </select>
</div>
```
Props: `RecipeForm({ recipe, imported, rooms, defaultRoomId })`. `defaultRoomId = recipe?.room_id ?? searchParamRoom ?? null`.

- [ ] **Step 3: Read `room_id` in `parseForm`** — add `room_id: (formData.get('room_id') as string) || null` to the returned `RecipeFormData`.

- [ ] **Step 4: Write `room_id` in `createRecipe`/`updateRecipe`** — include `room_id: input.room_id` in the recipes `insert`/`update` payloads. (RLS validates membership; moving a recipe just updates `room_id`, and its children remain attached and accessible via `can_access_recipe` against the new room.)

- [ ] **Step 5: Verify** — `npm run build` + `tsc` clean; `npm run test:run` green. Reason: creating from `/rooms/[id]` (`?room=id`) defaults Collection to that room; editing can move a recipe between Personal and a room.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(rooms): recipe Collection selector + room-aware save/move"`

---

## Phase 3 — Shared shopping list

### Task 8: Room-aware shopping data layer

**Files:**
- Modify: `src/lib/data/shopping.ts`

**Interfaces:**
- Consumes: `getRecipe` (to read `recipe.room_id`).
- Produces: `getShoppingList(roomId?)`, room-scoped `addRecipeToList`, `clearChecked(roomId?)`; `ShoppingListRow` gains `room_id: string | null`.

- [ ] **Step 1: Add `room_id` to `ShoppingListRow`** and scope reads:

```ts
export interface ShoppingListRow { id: string; name: string; total_quantity: number | null; unit: Unit; category: Aisle; checked: boolean; source_recipe_ids: string[]; room_id: string | null }

export async function getShoppingList(roomId: string | null = null): Promise<ShoppingListRow[]> {
  const supabase = await createClient()
  let q = supabase.from('shopping_list_items').select('*')
  q = roomId ? q.eq('room_id', roomId) : q.is('room_id', null)
  const { data, error } = await q
  if (error) throw error
  const rows = (data ?? []) as ShoppingListRow[]
  return rows.sort(/* existing aisle sort */)
}
```

- [ ] **Step 2: Make `addRecipeToList` room-aware** — derive the target list from the recipe's room and scope the merge/delete/insert by `room_id`:

```ts
export async function addRecipeToList(recipeId: string, servings: number): Promise<void> {
  const supabase = await createClient()
  const recipe = await getRecipe(recipeId)
  if (!recipe) throw new Error('Recipe not found')
  const roomId = recipe.room_id  // null = personal
  // ...scale + merge as today, but:
  const existingQ = supabase.from('shopping_list_items').select('*').eq('checked', false)
  const { data: existing } = await (roomId ? existingQ.eq('room_id', roomId) : existingQ.is('room_id', null))
  // ...after merge:
  const delQ = supabase.from('shopping_list_items').delete().eq('checked', false)
  const { error: delError } = await (roomId ? delQ.eq('room_id', roomId) : delQ.is('room_id', null))
  if (delError) throw delError
  if (merged.length) {
    const { error: insError } = await supabase.from('shopping_list_items').insert(
      merged.map((m) => ({ name: m.name, total_quantity: m.totalQuantity, unit: m.unit, category: m.category, source_recipe_ids: m.sourceRecipeIds, checked: false, room_id: roomId })))
    if (insError) throw insError
  }
}
```
(`user_id` continues to default to `auth.uid()` = "added by".)

- [ ] **Step 3: Make `clearChecked(roomId?)` scoped**:

```ts
export async function clearChecked(roomId: string | null = null): Promise<void> {
  const supabase = await createClient()
  const q = supabase.from('shopping_list_items').delete().eq('checked', true)
  const { error } = await (roomId ? q.eq('room_id', roomId) : q.is('room_id', null))
  if (error) throw error
}
```
(`setItemChecked`/`removeItem` stay by-`id`; RLS scopes them.)

- [ ] **Step 4: Verify** — `npm run test:run` green; `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit** — `git add src/lib/data/shopping.ts && git commit -m "feat(rooms): room-aware shopping data layer"`

### Task 9: Room shared shopping list page + wiring

**Files:**
- Create: `src/app/rooms/[roomId]/shopping-list/page.tsx`
- Modify: `src/app/shopping-list/actions.ts` (clear-checked passes context; add a room variant)
- Modify: `src/components/shopping-list-view.tsx` (accept `roomId?` so Clear-checked targets the right list)
- Modify: `src/components/add-to-list-button.tsx` + `src/components/recipe-detail.tsx` (redirect to the correct list after adding)

**Interfaces:**
- Consumes: `getRoom`, `getShoppingList(roomId)`, `clearChecked(roomId)`, `setItemChecked`, `removeItem`.

- [ ] **Step 1: Room shopping page** — `room = await getRoom(roomId)` (`notFound` if null); `items = await getShoppingList(roomId)`; render `<AppNav/>`, heading "<room> — Shopping list", `<ShoppingListView items={items} roomId={roomId} />`.

- [ ] **Step 2: Thread `roomId` through `shopping-list-view`** so the **Clear checked** form calls a `clearCheckedAction` bound to `roomId` (personal page passes no roomId → personal list). Add/adjust `clearCheckedAction(roomId?: string | null)` in `src/app/shopping-list/actions.ts` and revalidate the correct path.

- [ ] **Step 3: Redirect to the right list after "Add to list"** — `recipe-detail.tsx` passes the recipe's `room_id` to `AddToListButton`; in `add-to-list-button.tsx` redirect to `recipeRoomId ? `/rooms/${recipeRoomId}/shopping-list` : '/shopping-list'` instead of the hardcoded `/shopping-list`.

- [ ] **Step 4: Verify** — `npm run build` + `tsc` clean; `npm run test:run` green. Reason: adding a room recipe to the list lands on the room's shared list; the personal `/shopping-list` is unaffected.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(rooms): shared per-room shopping list page"`

---

## Phase 4 — Verification & docs

### Task 10: RLS isolation tests + setup docs

**Files:**
- Create: `supabase/tests/rooms_rls.test.sql` (pgTAP)
- Modify: `SETUP.md` (Rooms section: run the new migration; how rooms work)

**Interfaces:** none (verification only).

- [ ] **Step 1: Write pgTAP `rooms_rls.test.sql`** asserting, using `set local role` / `request.jwt.claims` simulation for two users A (owner) and B (member) and C (outsider): (a) A creates a room and is auto-member/owner; (b) B after `accept_room_invite` can select & insert a recipe with that `room_id`; (c) C cannot select/insert/update/delete that room's recipes, ingredients, steps, shopping items, members, or invites; (d) only A (owner) can insert `room_invites`/delete members/delete the room; (e) `accept_room_invite` raises on an email mismatch. Provide complete SQL assertions (no placeholders).

- [ ] **Step 2: Document run command** — `npx supabase test db` (requires Docker). Mark in the plan/ledger as **owner-run / deferred** if Docker is unavailable in the build environment, consistent with the original project's pgTAP handling.

- [ ] **Step 3: Update `SETUP.md`** — add a "Shared Rooms" subsection: paste-and-run the new `20260628220000_rooms.sql` (or re-run `setup_all.sql` on a fresh project), then a short "how rooms work" (create, invite by email, accept, equal editing, shared list).

- [ ] **Step 4: Commit** — `git add -A && git commit -m "test(rooms): pgTAP RLS isolation tests + SETUP docs"`

---

## Owner-run steps (cannot be done in the build environment)

These are deferred to the project owner (live Supabase required), surfaced at the end:
1. Apply `supabase/migrations/20260628220000_rooms.sql` in the Supabase SQL Editor (or re-run `setup_all.sql` on a fresh DB).
2. (Optional) Run `npx supabase test db` (Docker) for the pgTAP RLS suite.
3. Smoke test with two accounts: create room → invite the 2nd by email → accept → both add/edit/delete recipes → both share one shopping list → confirm a 3rd account sees none of it.

## Self-review notes (author)

- **Spec coverage:** rooms/members/invites tables + room_id (T1); data layer/actions (T2); /rooms create+invites (T3); members+invite/remove/leave/rename/delete (T4); context switcher (T5); room library + room-aware list (T6); Collection selector + move (T7); shared shopping data (T8) + page (T9); RLS tests + docs (T10). All spec sections mapped.
- **Type consistency:** `room_id: string | null` used uniformly; data-layer signatures match the "Shared interfaces" block; `RecipeFormData.room_id` defined in T1 and consumed in T7.
- **YAGNI:** no outbound email, no real-time, no per-member roles beyond owner/member — all explicitly out of scope.
