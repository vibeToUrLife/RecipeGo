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
create policy "rooms select" on public.rooms for select to authenticated using ( public.is_room_member(id) or owner_id = (select auth.uid()) );
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
create policy "invites update" on public.room_invites for update to authenticated using ( lower(email) = lower((select auth.email())) ) with check ( lower(email) = lower((select auth.email())) and status = 'declined' );
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
