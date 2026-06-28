-- RECIPES ---------------------------------------------------------------
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
  updated_at timestamptz not null default now()
);
create index recipes_user_id_idx on public.recipes (user_id);
alter table public.recipes enable row level security;

create policy "select own recipes" on public.recipes for select to authenticated
  using ( (select auth.uid()) = user_id );
create policy "insert own recipes" on public.recipes for insert to authenticated
  with check ( (select auth.uid()) = user_id );
create policy "update own recipes" on public.recipes for update to authenticated
  using ( (select auth.uid()) = user_id ) with check ( (select auth.uid()) = user_id );
create policy "delete own recipes" on public.recipes for delete to authenticated
  using ( (select auth.uid()) = user_id );

-- INGREDIENTS -----------------------------------------------------------
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

-- ownership flows through the parent recipe
create policy "select ingredients of own recipes" on public.ingredients for select to authenticated
  using ( exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = (select auth.uid())) );
create policy "insert ingredients of own recipes" on public.ingredients for insert to authenticated
  with check ( exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = (select auth.uid())) );
create policy "update ingredients of own recipes" on public.ingredients for update to authenticated
  using ( exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = (select auth.uid())) )
  with check ( exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = (select auth.uid())) );
create policy "delete ingredients of own recipes" on public.ingredients for delete to authenticated
  using ( exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = (select auth.uid())) );

-- STEPS -----------------------------------------------------------------
create table public.steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  step_number int not null,
  text text not null
);
create index steps_recipe_id_idx on public.steps (recipe_id);
alter table public.steps enable row level security;
create policy "select steps of own recipes" on public.steps for select to authenticated
  using ( exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = (select auth.uid())) );
create policy "insert steps of own recipes" on public.steps for insert to authenticated
  with check ( exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = (select auth.uid())) );
create policy "update steps of own recipes" on public.steps for update to authenticated
  using ( exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = (select auth.uid())) )
  with check ( exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = (select auth.uid())) );
create policy "delete steps of own recipes" on public.steps for delete to authenticated
  using ( exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = (select auth.uid())) );

-- TAGS ------------------------------------------------------------------
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
