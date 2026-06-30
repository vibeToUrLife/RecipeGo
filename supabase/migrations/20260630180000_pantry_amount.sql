-- ============ pantry: optional amount / "how much left" per ingredient ============
-- Free text (e.g. "2 kg", "6", "almost out") shown and edited on the
-- Ingredients page. Matching stays presence-based; this is just a note.
alter table public.pantry_items
  add column amount text;

-- The pantry was append-only before, so it had no UPDATE policy. Setting an
-- amount upserts (insert ... on conflict do update), which needs UPDATE.
create policy "pantry update" on public.pantry_items for update to authenticated
  using ( user_id = (select auth.uid()) )
  with check ( user_id = (select auth.uid()) );
