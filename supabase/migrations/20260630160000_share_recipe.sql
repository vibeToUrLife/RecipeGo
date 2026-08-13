-- ============ shareable recipe read (share-by-link) ============
-- Lets any signed-in user read a recipe's importable content by its id, so a
-- shared recipe link can be imported into another account. The recipe id is a
-- random UUID, so it acts as an unguessable share capability ("anyone with the
-- link"). Only importable content is exposed — never user_id / room_id / who
-- owns it. SECURITY DEFINER deliberately bypasses RLS for this read-only path.
create or replace function public.get_shareable_recipe(rid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'title', r.title,
    'description', r.description,
    'servings', r.servings,
    'prep_minutes', r.prep_minutes,
    'cook_minutes', r.cook_minutes,
    'source_url', r.source_url,
    'ingredients', coalesce(
      (select jsonb_agg(jsonb_build_object('name', i.name, 'quantity', i.quantity, 'unit', i.unit) order by i.position)
       from public.ingredients i where i.recipe_id = r.id), '[]'::jsonb),
    'steps', coalesce(
      (select jsonb_agg(s.text order by s.step_number)
       from public.steps s where s.recipe_id = r.id), '[]'::jsonb)
  )
  from public.recipes r
  where r.id = rid;
$$;

grant execute on function public.get_shareable_recipe(uuid) to authenticated;
