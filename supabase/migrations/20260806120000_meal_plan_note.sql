-- ============ meal plan: a free-text note per planned meal ============
-- e.g. "double the chilli", "Ana's coming", "use up the spinach". Purely a
-- reminder shown on the plan grid — nothing is derived from it, and the
-- shopping list ignores it. Null means no note.
--
-- The existing "plan update" policy already covers writes to this column, so
-- no new RLS is needed.
alter table public.meal_plan_entries
  add column note text;
