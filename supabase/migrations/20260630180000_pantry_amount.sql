-- ============ pantry: optional amount / "how much left" per ingredient ============
-- Free text (e.g. "2 kg", "6", "almost out") shown and edited on the
-- Ingredients page. Matching stays presence-based; this is just a note.
alter table public.pantry_items
  add column amount text;
