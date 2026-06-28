-- supabase/tests/rooms_rls.test.sql
-- pgTAP RLS isolation test for the Rooms feature.
--
-- Run with:  supabase test db
-- (requires Docker / local Supabase — deferred to project owner)
--
-- Auth simulation follows the standard Supabase pgTAP pattern:
--   set local role authenticated;
--   set local "request.jwt.claims" to '{"sub":"<uuid>","email":"<email>"}';
--   reset role;   -- returns to postgres (session user) between users

begin;
select plan(26);

-- ====================================================================
-- SETUP: seed three auth users as postgres (superuser — bypasses RLS).
-- The on_auth_user_created trigger will auto-create matching profiles rows.
--   User A  = owner   (a0000000-…-0001)
--   User B  = member  (b0000000-…-0002)
--   User C  = outsider(c0000000-…-0003)
-- ====================================================================
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000',
   'a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'usera@test.com', '',
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   'b0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'userb@test.com', '',
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   'c0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
   'userc@test.com', '',
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   '', '', '', '');

-- ====================================================================
-- (a) User A creates a room → on_room_created trigger auto-adds A as owner
-- ====================================================================
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub":"a0000000-0000-0000-0000-000000000001","email":"usera@test.com"}';

insert into public.rooms (id, name)
values ('d0000000-0000-0000-0000-000000000004', 'Test Room');

-- A invites B by email (owner privilege — invite will be tested in (d))
insert into public.room_invites (id, room_id, email)
values ('e0000000-0000-0000-0000-000000000005',
        'd0000000-0000-0000-0000-000000000004',
        'userb@test.com');

reset role;

-- #1 — on_room_created trigger auto-inserted A with role=owner
select is(
  (select role from public.room_members
   where room_id = 'd0000000-0000-0000-0000-000000000004'
     and user_id = 'a0000000-0000-0000-0000-000000000001'),
  'owner',
  '(a) on_room_created trigger auto-joins creator A with role=owner'
);

-- ====================================================================
-- (b) User B accepts the invite → becomes member; can select and insert
-- ====================================================================
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub":"b0000000-0000-0000-0000-000000000002","email":"userb@test.com"}';

-- #2 — accept_room_invite succeeds (no exception) for the correct invitee
select lives_ok(
  $$ select public.accept_room_invite('e0000000-0000-0000-0000-000000000005') $$,
  '(b) B can accept the room invite without error'
);

reset role;

-- #3 — accept_room_invite inserted B into room_members as member
select is(
  (select role from public.room_members
   where room_id = 'd0000000-0000-0000-0000-000000000004'
     and user_id = 'b0000000-0000-0000-0000-000000000002'),
  'member',
  '(b) B has role=member in room_members after accepting invite'
);

set local role authenticated;
set local "request.jwt.claims" to
  '{"sub":"b0000000-0000-0000-0000-000000000002","email":"userb@test.com"}';

-- #4 — member B can SELECT the room (is_room_member RLS policy satisfied)
select isnt_empty(
  $$ select id from public.rooms where id = 'd0000000-0000-0000-0000-000000000004' $$,
  '(b) member B can select the room'
);

-- #5 — member B can INSERT a recipe with room_id (RLS with check passes)
select lives_ok(
  $$ insert into public.recipes (id, user_id, title, room_id)
     values ('f0000000-0000-0000-0000-000000000006',
             'b0000000-0000-0000-0000-000000000002',
             'Room Recipe',
             'd0000000-0000-0000-0000-000000000004') $$,
  '(b) member B can insert a recipe with room_id'
);

-- #6 — member B can SELECT the recipe they just inserted
select isnt_empty(
  $$ select id from public.recipes where id = 'f0000000-0000-0000-0000-000000000006' $$,
  '(b) member B can select the room recipe'
);

reset role;

-- ====================================================================
-- (c) Outsider C: blocked selects return 0 rows; blocked inserts raise
--
-- Blocked SELECT  → is_empty()   (RLS USING hides rows, no exception)
-- Blocked INSERT  → throws_ok()  (RLS WITH CHECK fails, raises 42501)
-- ====================================================================
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub":"c0000000-0000-0000-0000-000000000003","email":"userc@test.com"}';

-- #7 — C cannot select room recipes
select is_empty(
  $$ select id from public.recipes where room_id = 'd0000000-0000-0000-0000-000000000004' $$,
  '(c) outsider C cannot select room recipes'
);

-- #8 — C cannot insert a recipe into the room
select throws_ok(
  $$ insert into public.recipes (id, user_id, title, room_id)
     values ('cc000000-0000-0000-0000-000000000001',
             'c0000000-0000-0000-0000-000000000003',
             'Evil Recipe',
             'd0000000-0000-0000-0000-000000000004') $$,
  '(c) outsider C cannot insert recipe into room'
);

-- #9 — C cannot select ingredients of the room recipe (can_access_recipe returns false)
select is_empty(
  $$ select id from public.ingredients where recipe_id = 'f0000000-0000-0000-0000-000000000006' $$,
  '(c) outsider C cannot select room recipe ingredients'
);

-- #10 — C cannot insert an ingredient into the room recipe
select throws_ok(
  $$ insert into public.ingredients (recipe_id, name)
     values ('f0000000-0000-0000-0000-000000000006', 'Evil Ingredient') $$,
  '(c) outsider C cannot insert ingredient into room recipe'
);

-- #11 — C cannot select steps of the room recipe
select is_empty(
  $$ select id from public.steps where recipe_id = 'f0000000-0000-0000-0000-000000000006' $$,
  '(c) outsider C cannot select room recipe steps'
);

-- #12 — C cannot insert a step into the room recipe
select throws_ok(
  $$ insert into public.steps (recipe_id, step_number, text)
     values ('f0000000-0000-0000-0000-000000000006', 1, 'Evil Step') $$,
  '(c) outsider C cannot insert step into room recipe'
);

-- #13 — C cannot select room shopping_list_items
select is_empty(
  $$ select id from public.shopping_list_items where room_id = 'd0000000-0000-0000-0000-000000000004' $$,
  '(c) outsider C cannot select room shopping_list_items'
);

-- #14 — C cannot insert a shopping_list_item with the room's room_id
select throws_ok(
  $$ insert into public.shopping_list_items (user_id, name, room_id)
     values ('c0000000-0000-0000-0000-000000000003',
             'Evil Item',
             'd0000000-0000-0000-0000-000000000004') $$,
  '(c) outsider C cannot insert shopping_list_item into room'
);

-- #15 — C cannot select room_members (is_room_member USING returns false)
select is_empty(
  $$ select user_id from public.room_members where room_id = 'd0000000-0000-0000-0000-000000000004' $$,
  '(c) outsider C cannot select room_members'
);

-- #16 — C cannot insert into room_members (policy requires is_room_owner)
select throws_ok(
  $$ insert into public.room_members (room_id, user_id, role)
     values ('d0000000-0000-0000-0000-000000000004',
             'c0000000-0000-0000-0000-000000000003',
             'member') $$,
  '(c) outsider C cannot insert into room_members'
);

-- #17 — C cannot select room_invites
select is_empty(
  $$ select id from public.room_invites where room_id = 'd0000000-0000-0000-0000-000000000004' $$,
  '(c) outsider C cannot select room_invites'
);

-- #18 — C cannot insert a room_invite (policy requires is_room_owner)
select throws_ok(
  $$ insert into public.room_invites (room_id, email)
     values ('d0000000-0000-0000-0000-000000000004', 'userc@test.com') $$,
  '(c) outsider C cannot insert room_invite'
);

reset role;

-- ====================================================================
-- (d) Member B cannot insert invites.
--     B's DELETE attempts on members/room are silently denied (0 rows,
--     no exception) — verified by confirming the data still exists.
--     Owner A CAN insert an invite.
-- ====================================================================
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub":"b0000000-0000-0000-0000-000000000002","email":"userb@test.com"}';

-- #19 — member B cannot insert a room_invite (policy requires is_room_owner)
select throws_ok(
  $$ insert into public.room_invites (room_id, email)
     values ('d0000000-0000-0000-0000-000000000004', 'userc@test.com') $$,
  '(d) member B cannot insert a room_invite'
);

-- RLS USING on DELETE returns 0 visible rows → 0 deleted, no exception.
-- B tries to delete A's membership (user_id = A, not B, not owner → invisible):
delete from public.room_members
where room_id = 'd0000000-0000-0000-0000-000000000004'
  and user_id = 'a0000000-0000-0000-0000-000000000001';

-- B tries to delete the room (is_room_owner returns false for B → invisible):
delete from public.rooms
where id = 'd0000000-0000-0000-0000-000000000004';

reset role;

-- #20 — A's owner row was not deleted (B's delete was silently ignored by RLS)
select isnt_empty(
  $$ select 1 from public.room_members
     where room_id = 'd0000000-0000-0000-0000-000000000004'
       and user_id = 'a0000000-0000-0000-0000-000000000001'
       and role = 'owner' $$,
  '(d) A remains room owner after member B attempted to delete the membership'
);

-- #21 — the room itself still exists after B's silent delete attempt
select isnt_empty(
  $$ select 1 from public.rooms where id = 'd0000000-0000-0000-0000-000000000004' $$,
  '(d) room still exists after member B attempted to delete it'
);

-- As owner A: confirm A CAN insert a room_invite
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub":"a0000000-0000-0000-0000-000000000001","email":"usera@test.com"}';

-- #22 — owner A can insert a room_invite for C
select lives_ok(
  $$ insert into public.room_invites (id, room_id, email)
     values ('f1000000-0000-0000-0000-000000000010',
             'd0000000-0000-0000-0000-000000000004',
             'userc@test.com') $$,
  '(d) owner A can insert a room_invite for C'
);

-- ====================================================================
-- (e) accept_room_invite raises 'invite is not for you' on email mismatch.
--     A (usera@test.com) tries to accept the invite meant for C (userc@test.com).
-- ====================================================================

-- #23 — email mismatch → SQLSTATE P0001 with the expected message
select throws_ok(
  $$ select public.accept_room_invite('f1000000-0000-0000-0000-000000000010') $$,
  'P0001',
  'invite is not for you',
  '(e) accept_room_invite raises when caller email does not match invite email'
);

reset role;

-- ====================================================================
-- (f) Outsider C: blocked UPDATE and DELETE on public.recipes
--
-- Under RLS the UPDATE/DELETE matches 0 visible rows (no exception).
-- Verified by confirming the value / row existence is unchanged.
-- ====================================================================
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub":"c0000000-0000-0000-0000-000000000003","email":"userc@test.com"}';

-- C attempts to UPDATE the room recipe (RLS USING clause hides the row)
update public.recipes
set title = 'hacked'
where id = 'f0000000-0000-0000-0000-000000000006';

-- C attempts to DELETE the room recipe (RLS USING clause hides the row)
delete from public.recipes
where id = 'f0000000-0000-0000-0000-000000000006';

reset role;

-- #24 — title is unchanged (C's UPDATE matched 0 visible rows)
select is(
  (select title from public.recipes where id = 'f0000000-0000-0000-0000-000000000006'),
  'Room Recipe',
  'C cannot update room recipe (title unchanged)'
);

-- #25 — row still exists (C's DELETE matched 0 visible rows)
select isnt_empty(
  $$ select 1 from public.recipes where id = 'f0000000-0000-0000-0000-000000000006' $$,
  'C cannot delete room recipe (row survives)'
);

-- ====================================================================
-- (g) Positive owner control: owner A can remove member B
--
-- All B-dependent assertions (#3–#6, #19–#21) are complete above, so
-- deleting B here does not invalidate any earlier check.
-- ====================================================================
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub":"a0000000-0000-0000-0000-000000000001","email":"usera@test.com"}';

-- #26 — owner A can delete member B from room_members without error
select lives_ok(
  $$ delete from public.room_members
     where room_id = 'd0000000-0000-0000-0000-000000000004'
       and user_id = 'b0000000-0000-0000-0000-000000000002' $$,
  'owner A can remove member B'
);

reset role;

select * from finish();
rollback;
