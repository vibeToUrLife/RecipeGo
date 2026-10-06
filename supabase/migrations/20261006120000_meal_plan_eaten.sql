-- ============ meal plan: mark a planned meal as eaten ============
-- The ✓ on a planned meal ticks it as eaten: it stays on the plan, crossed out,
-- stamped with when it was ticked, and "Add this week to shopping list" leaves
-- it out. Pressing ✓ again clears the stamp. Null means not eaten yet.
--
-- The existing "plan update" policy already covers writes to this column, so
-- no new RLS is needed.
alter table public.meal_plan_entries
  add column eaten_at timestamptz;
