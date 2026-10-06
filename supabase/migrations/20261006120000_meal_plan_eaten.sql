-- ============ meal plan: mark a planned meal as eaten ============
-- The ✓ on a planned meal soft-removes it: the row is kept, stamped with when it
-- was eaten, and the plan grid (and "Add this week to shopping list") leaves it
-- out. Undo clears the stamp. Null means not eaten yet.
--
-- The existing "plan update" policy already covers writes to this column, so
-- no new RLS is needed.
alter table public.meal_plan_entries
  add column eaten_at timestamptz;
