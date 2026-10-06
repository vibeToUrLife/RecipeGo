-- supabase/tests/meal_plan_eaten.test.sql
-- pgTAP: meal_plan_entries has the eaten_at stamp behind "mark as eaten".
-- Run with: supabase test db  (Docker required — deferred to owner)
begin;
select plan(3);
select has_column('public', 'meal_plan_entries', 'eaten_at', 'meal_plan_entries has eaten_at');
select col_type_is('public', 'meal_plan_entries', 'eaten_at', 'timestamp with time zone', 'eaten_at is timestamptz');
select col_is_null('public', 'meal_plan_entries', 'eaten_at', 'eaten_at is nullable (null = not eaten yet)');
select * from finish();
rollback;
