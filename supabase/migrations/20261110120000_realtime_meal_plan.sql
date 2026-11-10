-- Put the meal plan on Realtime where it never was. Databases set up from the
-- first copy of setup_all.sql ran its realtime block before that file had the
-- planner table, which the block skips when missing; and the planner's repair
-- (re-running just its section, as SETUP.md said) never ran the block again.
-- So a plan never changed by itself when someone else changed it, though every
-- other room page did.
--
-- The loop of 20260704120000_realtime_rooms.sql again, over every room table:
-- it adds only what's missing, saying so, and leaves a database that has it
-- all as it is.
do $$
declare
  t text;
  room_tables text[] := array[
    'recipes', 'shopping_list_items', 'meal_plan_entries',
    'room_members', 'room_invites', 'rooms'
  ];
  pub_all boolean;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  select puballtables into pub_all from pg_publication where pubname = 'supabase_realtime';
  foreach t in array room_tables loop
    if to_regclass('public.' || t) is null then
      raise notice 'realtime: no table %, skipped', t;
      continue;
    end if;
    if not coalesce(pub_all, false) and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
      raise notice 'realtime: % was not published, and now is', t;
    end if;
    -- Whole rows, so a delete carries the room_id and user_id the pages'
    -- filters match on (see 20260704120000_realtime_rooms.sql).
    if (select relreplident from pg_class where oid = to_regclass('public.' || t)) <> 'f' then
      execute format('alter table public.%I replica identity full', t);
      raise notice 'realtime: % now sends whole rows', t;
    end if;
  end loop;
end $$;
