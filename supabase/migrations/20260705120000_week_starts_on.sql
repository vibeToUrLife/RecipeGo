-- Per-user preferred first day of the week for the meal planner.
-- 0=Sunday … 6=Saturday. Default 1 (Monday) = existing behavior. Idempotent.
alter table public.profiles
  add column if not exists week_starts_on smallint not null default 1
  check (week_starts_on between 0 and 6);
