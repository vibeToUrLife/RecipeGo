# RecipeGo Rooms (Shared Cookbooks) — Design Spec

**Date:** 2026-06-28
**Status:** Approved (design); pending spec review → implementation plan
**Builds on:** the existing RecipeGo app (Next.js 16 + Supabase, personal recipes + shopping list).

## Goal

Let a user create a **Room** (a shared cookbook), **invite other users by email**, and have all room members **equally add, edit, and delete** the room's recipes and share **one per-room shopping list** — while each user's existing **"My Recipes"** stay private.

## Approved decisions

1. **Sharing model:** Rooms = shared cookbooks. A recipe belongs to *either* a user's private space (`room_id = null`) *or* exactly one room. A user may belong to many rooms.
2. **Invites:** by email. Inviting creates an in-app *pending invite* (no external email is sent). The invitee sees and accepts it when logged in with that email. New users can sign up first, then accept.
3. **Permissions:** all room members are equal — any member can add, edit, and delete any recipe in the room. The **owner** additionally manages membership (invite, remove members, rename/delete the room). **Owner-only invites.**
4. **Shopping list:** each room has **one shared shopping list** all members see and tick off. Personal ("My Recipes") shopping list stays private.

## Architecture overview

The app gains a **context** dimension: the current view is either *Personal* or a specific *Room*. Recipes and shopping-list items carry a nullable `room_id`. Row-Level Security (RLS) is rewritten so that:
- personal rows (`room_id is null`) are visible/editable only by their `user_id`;
- room rows are visible/editable by **any member** of that room.

Membership/ownership checks are centralized in `SECURITY DEFINER` SQL helper functions (so RLS policies don't recurse through `room_members`' own RLS).

## Data model

### New tables

```sql
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

create table public.room_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  email text not null,
  invited_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  unique (room_id, email)
);
```

### Modified tables

```sql
alter table public.recipes add column room_id uuid references public.rooms(id) on delete cascade;
create index recipes_room_id_idx on public.recipes (room_id);

alter table public.shopping_list_items add column room_id uuid references public.rooms(id) on delete cascade;
create index shopping_list_items_room_id_idx on public.shopping_list_items (room_id);
```

`recipes.user_id` and `shopping_list_items.user_id` are retained as **"added by"** (the creator), even for room rows.

### Helper functions (SECURITY DEFINER, `set search_path = ''`)

```sql
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
            or (r.room_id is not null and public.is_room_member(r.room_id)) )
  );
$$;
```

### Triggers / functions

- **Auto-add owner as member** on room creation:

```sql
create or replace function public.handle_new_room()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.room_members (room_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end; $$;
create trigger on_room_created after insert on public.rooms
  for each row execute procedure public.handle_new_room();
```

- **Accept invite** (validates the invite belongs to the caller's email, adds membership, marks accepted):

```sql
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
```

### RLS policies (all tables `to authenticated`)

- **rooms** — select: `is_room_member(id)`; insert (check): `owner_id = (select auth.uid())`; update/delete: `is_room_owner(id)`.
- **room_members** — select: `is_room_member(room_id)`; insert (check): `is_room_owner(room_id)` *(self-join happens via `accept_room_invite`, a definer function, so it needs no policy)*; delete: `is_room_owner(room_id) or user_id = (select auth.uid())` *(owner removes anyone; member leaves)*.
- **room_invites** — select: `is_room_member(room_id) or lower(email) = lower((select auth.email()))`; insert (check): `is_room_owner(room_id)`; update: `lower(email) = lower((select auth.email()))` *(invitee declines; accept goes through the function)*; delete: `is_room_owner(room_id)` *(cancel pending invite)*.
- **recipes** — every action uses: `(room_id is null and user_id = (select auth.uid())) or (room_id is not null and is_room_member(room_id))` (insert/update as `with check`, select/update/delete as `using`). The existing 4 personal-only policies are **dropped and replaced**.
- **ingredients, steps** — all four actions use `can_access_recipe(recipe_id)`. Existing policies **dropped and replaced**.
- **shopping_list_items** — every action uses: `(room_id is null and user_id = (select auth.uid())) or (room_id is not null and is_room_member(room_id))`. Existing policies **dropped and replaced**.

The migration must `drop policy` the old recipes/ingredients/steps/shopping policies before creating the new ones. Existing rows keep `room_id = null`, so all current data stays personal and reachable — backward compatible.

## Routing & UI

| Route | Purpose |
|---|---|
| `/` | My Recipes (personal library) — *existing* |
| `/shopping-list` | Personal shopping list — *existing* |
| `/rooms` | My rooms + pending invites to accept/decline + create a room |
| `/rooms/[roomId]` | A room's recipe library (the shared cookbook) |
| `/rooms/[roomId]/shopping-list` | The room's shared shopping list |
| `/rooms/[roomId]/members` | Members list + invite-by-email form (owner) + leave/remove |
| `/recipes/new`, `/recipes/[id]`, `/recipes/[id]/edit` | *existing*, made room-aware (see below) |

- **Context switcher** in the top nav (`app-nav`): a dropdown listing **My Recipes** + each room the user belongs to, plus a **Manage rooms** link. Selecting a room navigates to `/rooms/[roomId]`.
- **Collection dropdown** on the recipe form: `Personal | <room A> | <room B> …`, bound to `room_id`. Creating a recipe from a room context pre-selects that room; editing lets you **move** a recipe between Personal and a room. (Moving carries its ingredients/steps; only members of the target room can select it.)
- **Recipe cards** in a room show **"added by ___"** (display name from `profiles`). Equal permissions mean Edit/Delete appear for every member.
- **Pending-invite UI:** on `/rooms` (and a small badge/notice), the invitee sees each pending invite with **Accept** / **Decline**.
- **Add to shopping list:** for a personal recipe → personal list; for a room recipe → that room's shared list (still aisle-grouped and auto-merged). The shared list shows **"added by ___"** per item.

## Data-layer changes

- `listRecipes(roomId?: string | null)` → personal: `room_id is null`; room: `room_id = roomId`.
- recipe create/update actions accept a `room_id` (validated: null or a room the user belongs to).
- `getShoppingList(roomId?)` and the shopping mutations become room-aware (scope by `room_id`); `addRecipeToList` derives the target list from the recipe's `room_id`.
- New `lib/data/rooms.ts`: `listMyRooms()`, `getRoom(id)`, `createRoom(name)`, `listMembers(roomId)`, `inviteToRoom(roomId, email)`, `listPendingInvites()` (for me), `acceptInvite(id)` (RPC), `declineInvite(id)`, `removeMember(roomId, userId)`, `leaveRoom(roomId)`, `renameRoom`, `deleteRoom`.

## Build phases (one feature, three independently testable stages)

1. **Rooms plumbing** — migration (tables, columns, helper functions, trigger, accept function, RLS rewrite); types; `lib/data/rooms.ts`; `/rooms` page (create room, list rooms, pending invites accept/decline); owner invite-by-email + `/rooms/[roomId]/members`.
2. **Room-scoped recipes** — context switcher in nav; `/rooms/[roomId]` library; Collection dropdown in recipe form; room-aware `listRecipes` + recipe actions writing `room_id`; "added by" display.
3. **Shared shopping list** — room-aware shopping data layer; `/rooms/[roomId]/shopping-list`; `addRecipeToList` routes by recipe `room_id`; "added by" on items.

## Testing

- **RLS isolation (critical)** — pgTAP tests proving: a non-member cannot select/insert/update/delete a room's recipes, ingredients, steps, shopping items, members, or invites; a member can; only the owner can invite/remove/rename/delete; `accept_room_invite` rejects an email mismatch. (Runs via Supabase CLI + Docker; if Docker is unavailable, verified through the app smoke test.)
- **Pure logic** — any new pure helpers (e.g. invite-email normalization) get Vitest unit tests; existing 63 tests must stay green.
- **Build/type-check** — `npm run build` + `tsc` clean each task.
- **Smoke** — two accounts: create room, invite the second by email, accept, both add/edit/delete recipes, both share one shopping list; confirm a third unrelated account sees none of it.

## Security notes

- Room isolation is enforced by RLS, not the UI. The `service_role` key stays server-only and is **not** used for room reads/writes (those go through the user's RLS-scoped client).
- All `SECURITY DEFINER` functions set `search_path = ''` and fully-qualify object names.
- `accept_room_invite` verifies `auth.email()` matches the invite before granting membership.

## Out of scope (possible later)

- Real outbound invite emails (currently in-app pending invites).
- Roles beyond owner/member; per-member edit restrictions.
- Real-time live updates (members refresh to see changes).
- Copying (vs moving) a recipe into a room; leaving a recipe in multiple rooms.
