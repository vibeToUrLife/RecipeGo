-- supabase/tests/realtime_publication.test.sql
-- pgTAP: the six room tables are published for Realtime with full replica identity.
--
-- Run with:  supabase test db
-- (requires Docker / local Supabase — deferred to project owner, per rooms_rls.test.sql)

begin;
select plan(12);

-- 1..6: each table is a member of the supabase_realtime publication
select ok(
  exists(
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'recipes'
  ),
  'recipes is published to supabase_realtime'
);
select ok(
  exists(
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shopping_list_items'
  ),
  'shopping_list_items is published to supabase_realtime'
);
select ok(
  exists(
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'meal_plan_entries'
  ),
  'meal_plan_entries is published to supabase_realtime'
);
select ok(
  exists(
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room_members'
  ),
  'room_members is published to supabase_realtime'
);
select ok(
  exists(
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room_invites'
  ),
  'room_invites is published to supabase_realtime'
);
select ok(
  exists(
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rooms'
  ),
  'rooms is published to supabase_realtime'
);

-- 7..12: each table has REPLICA IDENTITY FULL (pg_class.relreplident = 'f')
select is( (select relreplident::text from pg_class where oid = 'public.recipes'::regclass),             'f', 'recipes has replica identity full' );
select is( (select relreplident::text from pg_class where oid = 'public.shopping_list_items'::regclass), 'f', 'shopping_list_items has replica identity full' );
select is( (select relreplident::text from pg_class where oid = 'public.meal_plan_entries'::regclass),   'f', 'meal_plan_entries has replica identity full' );
select is( (select relreplident::text from pg_class where oid = 'public.room_members'::regclass),        'f', 'room_members has replica identity full' );
select is( (select relreplident::text from pg_class where oid = 'public.room_invites'::regclass),        'f', 'room_invites has replica identity full' );
select is( (select relreplident::text from pg_class where oid = 'public.rooms'::regclass),               'f', 'rooms has replica identity full' );

select * from finish();
rollback;
