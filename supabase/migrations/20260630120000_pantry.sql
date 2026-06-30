-- ============ PANTRY (ingredients the user currently has at home) ============
create table public.pantry_items (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, name)
);

alter table public.pantry_items enable row level security;
create policy "pantry select" on public.pantry_items for select to authenticated using ( user_id = (select auth.uid()) );
create policy "pantry insert" on public.pantry_items for insert to authenticated with check ( user_id = (select auth.uid()) );
create policy "pantry delete" on public.pantry_items for delete to authenticated using ( user_id = (select auth.uid()) );
