-- Enable Supabase Realtime for the room-scoped tables so member changes stream
-- live to everyone viewing the room. Idempotent and safe to re-run.

-- 1. Ensure the publication exists (Supabase ships it by default; guard fresh local DBs).
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- 2. Publish each room table + set REPLICA IDENTITY FULL.
--    FULL is required so UPDATE/DELETE events carry the old row (incl. room_id),
--    which the client channel needs to match its room_id=eq.<id> filter on deletes.
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
      continue;
    end if;
    -- Add to the publication only if it isn't already covered.
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
