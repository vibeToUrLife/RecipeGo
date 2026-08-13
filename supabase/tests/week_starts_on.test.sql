-- supabase/tests/week_starts_on.test.sql
-- pgTAP: profiles has the week_starts_on preference column.
-- Run with: supabase test db  (Docker required — deferred to owner)
begin;
select plan(3);
select has_column('public', 'profiles', 'week_starts_on', 'profiles has week_starts_on');
select col_type_is('public', 'profiles', 'week_starts_on', 'smallint', 'week_starts_on is smallint');
select col_not_null('public', 'profiles', 'week_starts_on', 'week_starts_on is NOT NULL');
select * from finish();
rollback;
