-- ============ push notifications ============
-- A phone (or browser) that has turned notifications on keeps its push
-- subscription here: the push service's address for it, and the keys its
-- messages are encrypted with. When someone changes a room's meal plan or
-- shopping list, the server tells the other members' phones.
--
-- Only the server saves them, with the service role key (which bypasses RLS),
-- after checking the address is a real push service's: the server sends to
-- whatever address is saved. Each user can see and delete their own. Telling
-- the other members needs their subscriptions too, which the server reads the
-- same way, so no member can read another member's.
create table public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  -- The language this phone's notifications are written in.
  locale text not null default 'en' check (locale in ('en', 'zh')),
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
create policy "push subscriptions select" on public.push_subscriptions for select to authenticated
  using ( user_id = (select auth.uid()) );
create policy "push subscriptions delete" on public.push_subscriptions for delete to authenticated
  using ( user_id = (select auth.uid()) );

-- When each member last set off each kind of notice in each room, so a run of
-- changes (ten items added one by one) buzzes the others' phones once, not ten
-- times. Only the server uses it, with the service role key: RLS is on and no
-- policy lets anyone else in.
create table public.push_notices (
  room_id uuid not null references public.rooms(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  sent_at timestamptz not null default now(),
  primary key (room_id, actor_id, kind)
);
alter table public.push_notices enable row level security;
