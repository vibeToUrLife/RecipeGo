-- ============ shopping list: mark items as food vs non-food (daily) ============
-- Only food items are saved to the pantry/Ingredients when a shopping trip is
-- completed. Existing rows are recipe-derived, so they default to food.
alter table public.shopping_list_items
  add column is_food boolean not null default true;
