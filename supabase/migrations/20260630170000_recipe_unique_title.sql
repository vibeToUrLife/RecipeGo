-- ============ recipe name uniqueness within a collection ============
-- A recipe name must be unique within a single collection, but the same name
-- may exist in different collections:
--   * within one room: no two recipes share a name (any member);
--   * within a user's personal recipes (room_id is null): no two share a name;
--   * different rooms (or different users' personal lists) may reuse a name.
-- Case- and whitespace-insensitive so "Pasta" and " pasta " collide.
create unique index if not exists recipes_unique_room_title
  on public.recipes (room_id, lower(btrim(title)))
  where room_id is not null;

create unique index if not exists recipes_unique_personal_title
  on public.recipes (user_id, lower(btrim(title)))
  where room_id is null;
