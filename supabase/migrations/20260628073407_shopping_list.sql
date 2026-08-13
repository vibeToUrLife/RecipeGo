create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  total_quantity numeric,
  unit text,
  category text not null default 'Other',
  checked boolean not null default false,
  source_recipe_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index shopping_list_items_user_id_idx on public.shopping_list_items (user_id);
alter table public.shopping_list_items enable row level security;

create policy "select own list items" on public.shopping_list_items for select to authenticated
  using ( (select auth.uid()) = user_id );
create policy "insert own list items" on public.shopping_list_items for insert to authenticated
  with check ( (select auth.uid()) = user_id );
create policy "update own list items" on public.shopping_list_items for update to authenticated
  using ( (select auth.uid()) = user_id ) with check ( (select auth.uid()) = user_id );
create policy "delete own list items" on public.shopping_list_items for delete to authenticated
  using ( (select auth.uid()) = user_id );
