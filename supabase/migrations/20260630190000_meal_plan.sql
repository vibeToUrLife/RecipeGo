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
