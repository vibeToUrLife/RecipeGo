-- RecipeGo — full database setup
-- Paste this entire file into the Supabase SQL Editor and click Run.
-- (Dashboard -> SQL Editor -> New query.) Equivalent to applying every file
-- in supabase/migrations/ in order. Safe to run once on a fresh project.

-- ========== 1. PROFILES ==========
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "Profiles are viewable by authenticated users"
on public.profiles for select to authenticated using ( true );
create policy "Users can update own profile"
on public.profiles for update to authenticated
using ( (select auth.uid()) = id )
with check ( (select auth.uid()) = id );
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ========== 2. ROOMS ==========
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

-- membership helper functions (SECURITY DEFINER, no RLS recursion)
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
-- auto-add owner as member
create or replace function public.handle_new_room()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.room_members (room_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end; $$;
create trigger on_room_created after insert on public.rooms
  for each row execute procedure public.handle_new_room();

-- accept invite
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

-- my pending invites (with room name; invitee is not yet a member, so
-- they cannot read public.rooms via RLS — this definer function exposes just the name)
create or replace function public.my_pending_invites()
returns table (id uuid, room_id uuid, room_name text, created_at timestamptz)
language sql security definer stable set search_path = '' as $$
  select i.id, i.room_id, r.name, i.created_at
  from public.room_invites i join public.rooms r on r.id = i.room_id
  where i.status = 'pending' and lower(i.email) = lower((select auth.email()));
$$;

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

-- ========== 3. RECIPES / INGREDIENTS / STEPS / TAGS ==========
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  description text,
  image_path text,
  servings int not null default 1 check (servings > 0),
  prep_minutes int,
  cook_minutes int,
  difficulty text check (difficulty in ('easy','medium','hard')),
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  room_id uuid references public.rooms(id) on delete cascade
);
create index recipes_user_id_idx on public.recipes (user_id);
create index recipes_room_id_idx on public.recipes (room_id);
create or replace function public.can_access_recipe(p_recipe uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.recipes r
    where r.id = p_recipe
      and ( (r.room_id is null and r.user_id = (select auth.uid()))
            or (r.room_id is not null and public.is_room_member(r.room_id)) ));
$$;
alter table public.recipes enable row level security;
create policy "recipes select" on public.recipes for select to authenticated
  using ( (room_id is null and user_id = (select auth.uid())) or (room_id is not null and public.is_room_member(room_id)) );
create policy "recipes insert" on public.recipes for insert to authenticated
  with check ( (room_id is null and user_id = (select auth.uid())) or (room_id is not null and public.is_room_member(room_id)) );
create policy "recipes update" on public.recipes for update to authenticated
  using ( (room_id is null and user_id = (select auth.uid())) or (room_id is not null and public.is_room_member(room_id)) )
  with check ( (room_id is null and user_id = (select auth.uid())) or (room_id is not null and public.is_room_member(room_id)) );
create policy "recipes delete" on public.recipes for delete to authenticated
  using ( (room_id is null and user_id = (select auth.uid())) or (room_id is not null and public.is_room_member(room_id)) );

-- Recipe name must be unique within a collection (room, or a user's personal
-- list); the same name may exist in different collections. See migration
-- 20260630170000_recipe_unique_title.sql.
create unique index if not exists recipes_unique_room_title
  on public.recipes (room_id, lower(btrim(title))) where room_id is not null;
create unique index if not exists recipes_unique_personal_title
  on public.recipes (user_id, lower(btrim(title))) where room_id is null;

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  name text not null,
  quantity numeric,
  unit text,
  category text not null default 'Other',
  position int not null default 0
);
create index ingredients_recipe_id_idx on public.ingredients (recipe_id);
alter table public.ingredients enable row level security;
create policy "ingredients select" on public.ingredients for select to authenticated using ( public.can_access_recipe(recipe_id) );
create policy "ingredients insert" on public.ingredients for insert to authenticated with check ( public.can_access_recipe(recipe_id) );
create policy "ingredients update" on public.ingredients for update to authenticated using ( public.can_access_recipe(recipe_id) ) with check ( public.can_access_recipe(recipe_id) );
create policy "ingredients delete" on public.ingredients for delete to authenticated using ( public.can_access_recipe(recipe_id) );

create table public.steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  step_number int not null,
  text text not null,
  image_path text
);
create index steps_recipe_id_idx on public.steps (recipe_id);
alter table public.steps enable row level security;
create policy "steps select" on public.steps for select to authenticated using ( public.can_access_recipe(recipe_id) );
create policy "steps insert" on public.steps for insert to authenticated with check ( public.can_access_recipe(recipe_id) );
create policy "steps update" on public.steps for update to authenticated using ( public.can_access_recipe(recipe_id) ) with check ( public.can_access_recipe(recipe_id) );
create policy "steps delete" on public.steps for delete to authenticated using ( public.can_access_recipe(recipe_id) );

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  unique (user_id, name)
);
create index tags_user_id_idx on public.tags (user_id);
alter table public.tags enable row level security;
create policy "select own tags" on public.tags for select to authenticated
  using ( (select auth.uid()) = user_id );
create policy "insert own tags" on public.tags for insert to authenticated
  with check ( (select auth.uid()) = user_id );
create policy "delete own tags" on public.tags for delete to authenticated
  using ( (select auth.uid()) = user_id );

create table public.recipe_tags (
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (recipe_id, tag_id)
);
alter table public.recipe_tags enable row level security;
create policy "select own recipe_tags" on public.recipe_tags for select to authenticated
  using ( exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = (select auth.uid())) );
create policy "insert own recipe_tags" on public.recipe_tags for insert to authenticated
  with check ( exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = (select auth.uid())) );
create policy "delete own recipe_tags" on public.recipe_tags for delete to authenticated
  using ( exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = (select auth.uid())) );

-- ========== 4. SHOPPING LIST ==========
create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  total_quantity numeric,
  unit text,
  category text not null default 'Other',
  checked boolean not null default false,
  source_recipe_ids uuid[] not null default '{}',
  is_food boolean not null default true,
  created_at timestamptz not null default now(),
  room_id uuid references public.rooms(id) on delete cascade
);
create index shopping_list_items_user_id_idx on public.shopping_list_items (user_id);
create index shopping_list_items_room_id_idx on public.shopping_list_items (room_id);
alter table public.shopping_list_items enable row level security;
create policy "list select" on public.shopping_list_items for select to authenticated
  using ( (room_id is null and user_id = (select auth.uid())) or (room_id is not null and public.is_room_member(room_id)) );
create policy "list insert" on public.shopping_list_items for insert to authenticated
  with check ( (room_id is null and user_id = (select auth.uid())) or (room_id is not null and public.is_room_member(room_id)) );
create policy "list update" on public.shopping_list_items for update to authenticated
  using ( (room_id is null and user_id = (select auth.uid())) or (room_id is not null and public.is_room_member(room_id)) )
  with check ( (room_id is null and user_id = (select auth.uid())) or (room_id is not null and public.is_room_member(room_id)) );
create policy "list delete" on public.shopping_list_items for delete to authenticated
  using ( (room_id is null and user_id = (select auth.uid())) or (room_id is not null and public.is_room_member(room_id)) );

-- ========== 4b. PANTRY (ingredients the user currently has) ==========
create table public.pantry_items (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  amount text,
  created_at timestamptz not null default now(),
  primary key (user_id, name)
);
alter table public.pantry_items enable row level security;
create policy "pantry select" on public.pantry_items for select to authenticated using ( user_id = (select auth.uid()) );
create policy "pantry insert" on public.pantry_items for insert to authenticated with check ( user_id = (select auth.uid()) );
create policy "pantry update" on public.pantry_items for update to authenticated using ( user_id = (select auth.uid()) ) with check ( user_id = (select auth.uid()) );
create policy "pantry delete" on public.pantry_items for delete to authenticated using ( user_id = (select auth.uid()) );

-- ========== 5. IMAGE STORAGE ==========
insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', true)
on conflict (id) do nothing;
create policy "Anyone can read recipe images"
on storage.objects for select using ( bucket_id = 'recipe-images' );
create policy "Users upload to own folder"
on storage.objects for insert to authenticated
with check ( bucket_id = 'recipe-images' and (storage.foldername(name))[1] = (select auth.uid())::text );
create policy "Users update own files"
on storage.objects for update to authenticated
using ( bucket_id = 'recipe-images' and (storage.foldername(name))[1] = (select auth.uid())::text );
create policy "Users delete own files"
on storage.objects for delete to authenticated
using ( bucket_id = 'recipe-images' and (storage.foldername(name))[1] = (select auth.uid())::text );

-- ============ shareable recipe read (share-by-link) ============
-- See migration 20260630160000_share_recipe.sql. Read-only importable content
-- for any recipe id; SECURITY DEFINER bypasses RLS for the share-by-link path.
create or replace function public.get_shareable_recipe(rid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'title', r.title,
    'description', r.description,
    'servings', r.servings,
    'prep_minutes', r.prep_minutes,
    'cook_minutes', r.cook_minutes,
    'source_url', r.source_url,
    'ingredients', coalesce(
      (select jsonb_agg(jsonb_build_object('name', i.name, 'quantity', i.quantity, 'unit', i.unit) order by i.position)
       from public.ingredients i where i.recipe_id = r.id), '[]'::jsonb),
    'steps', coalesce(
      (select jsonb_agg(s.text order by s.step_number)
       from public.steps s where s.recipe_id = r.id), '[]'::jsonb)
  )
  from public.recipes r
  where r.id = rid;
$$;

grant execute on function public.get_shareable_recipe(uuid) to authenticated;

-- ========== 6. REALTIME (room live sync) ==========
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
    -- Skip tables not present in this database (keeps the aggregate
    -- setup_all.sql runnable even if a table's DDL was not folded in yet).
    if to_regclass('public.' || t) is null then
      raise notice 'realtime: skipping missing table %', t;
      continue;
    end if;
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

