-- supabase/tests/push_rls.test.sql
-- pgTAP: the push notification tables. A member never sees another member's
-- phones; only the server (the service role, which bypasses RLS) saves them or
-- keeps the notice log; a member can delete their own (turning them off).
--
-- Run with:  supabase test db
-- (requires Docker / local Supabase — deferred to project owner)
begin;
select plan(11);

-- Two members of one room, a phone each (seeded as postgres, past RLS).
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000',
   'a1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'push-a@test.com', '', now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   'b1000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'push-b@test.com', '', now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '');
insert into public.rooms (id, name, owner_id)
values ('d1000000-0000-0000-0000-000000000004', 'Push Room', 'a1000000-0000-0000-0000-000000000001');
insert into public.room_members (room_id, user_id)
values ('d1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000002');
insert into public.push_subscriptions (endpoint, user_id, p256dh, auth, locale) values
  ('https://fcm.googleapis.com/fcm/send/a', 'a1000000-0000-0000-0000-000000000001', 'ka', 'sa', 'en'),
  ('https://fcm.googleapis.com/fcm/send/b', 'b1000000-0000-0000-0000-000000000002', 'kb', 'sb', 'zh');
insert into public.push_notices (room_id, actor_id, kind)
values ('d1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 'list');

select has_table('public', 'push_subscriptions', 'push_subscriptions exists');
select has_table('public', 'push_notices', 'push_notices exists');
select throws_ok(
  $$ insert into public.push_subscriptions (endpoint, user_id, p256dh, auth, locale)
     values ('https://fcm.googleapis.com/fcm/send/c', 'a1000000-0000-0000-0000-000000000001', 'k', 's', 'fr') $$,
  '23514', null,
  'a language the app does not have is refused'
);

-- As member B.
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub":"b1000000-0000-0000-0000-000000000002","email":"push-b@test.com"}';

select results_eq(
  $$ select endpoint from public.push_subscriptions $$,
  $$ values ('https://fcm.googleapis.com/fcm/send/b') $$,
  'B sees only their own phone, not fellow member A''s'
);
select throws_ok(
  $$ insert into public.push_subscriptions (endpoint, user_id, p256dh, auth)
     values ('https://fcm.googleapis.com/fcm/send/x', 'b1000000-0000-0000-0000-000000000002', 'k', 's') $$,
  '42501', null,
  'B cannot save a subscription directly, even their own: only the server does, after checking it'
);
select is_empty($$ select 1 from public.push_notices $$, 'B cannot read the notice log');
select throws_ok(
  $$ insert into public.push_notices (room_id, actor_id, kind)
     values ('d1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000002', 'plan') $$,
  '42501', null,
  'B cannot write the notice log'
);
-- These go nowhere (RLS hides the rows); checked below as postgres.
update public.push_subscriptions set endpoint = 'https://evil.example/b'
  where endpoint = 'https://fcm.googleapis.com/fcm/send/b';
delete from public.push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/a';

reset role;
select is(
  (select count(*) from public.push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/a'),
  1::bigint,
  'B cannot delete fellow member A''s phone'
);
select is(
  (select count(*) from public.push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/b'),
  1::bigint,
  'B cannot point their own phone''s subscription at another address'
);

-- B turns notifications off.
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub":"b1000000-0000-0000-0000-000000000002","email":"push-b@test.com"}';
delete from public.push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/b';
reset role;
select is(
  (select count(*) from public.push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/b'),
  0::bigint,
  'B can delete their own phone''s subscription'
);

-- The server reads every member's phones.
set local role service_role;
select is(
  (select count(*) from public.push_subscriptions),
  1::bigint,
  'the service role reads every member''s subscriptions'
);
reset role;

select * from finish();
rollback;
