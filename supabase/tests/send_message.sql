-- Integration test for send_message (migration 042): only the admin sends, only to active accounts.
-- Run in the Supabase SQL editor or via MCP execute_sql. It creates temporary users and rows,
-- prints one line per check (ok = got matches expected) and ALWAYS rolls back: nothing is kept.
begin;
create temp table res (k text, got text, expected text);
grant all on res to authenticated, anon;
create function pg_temp.chk(k text, got anyelement, expected anyelement) returns void language sql as
$f$ insert into res values (k, got::text, expected::text) $f$;
grant execute on function pg_temp.chk(text, anyelement, anyelement) to authenticated, anon;
-- runs one statement as the current user and returns 'ok' or the SQLSTATE it failed with
create function pg_temp.try(q text) returns text language plpgsql as
$f$ begin execute q; return 'ok'; exception when others then return sqlstate; end $f$;
grant execute on function pg_temp.try(text) to authenticated, anon;

-- people: admin (existing), O = owner, U = plain user, X = a stopped account
insert into private.allowed_emails(email) values ('o@t.local'), ('u@t.local'), ('x@t.local');
insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','o@t.local'),
  ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','u@t.local'),
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','x@t.local');
update public.profiles set is_active = true where email in ('o@t.local','u@t.local');
update public.profiles set is_active = false where email = 'x@t.local';
update public.profiles set role = 'owner' where email = 'o@t.local';

create temp table ids (admin uuid);
grant all on ids to authenticated;
insert into ids (admin) select id from public.profiles where role = 'admin' limit 1;

-- ===== a plain user and an owner cannot send =====
select set_config('role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select pg_temp.chk('U_cannot_send',
  pg_temp.try($q$select public.send_message(array['00000000-0000-0000-0000-0000000000a1']::uuid[], 'x', null)$q$), '42501');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select pg_temp.chk('O_cannot_send',
  pg_temp.try($q$select public.send_message(array['00000000-0000-0000-0000-0000000000b1']::uuid[], 'x', null)$q$), '42501');

-- ===== the admin sends =====
select set_config('request.jwt.claims', json_build_object('sub',(select admin from ids),'role','authenticated')::text, true);
select pg_temp.chk('admin_sends_to_two_active_accounts',
  public.send_message(array['00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000c1']::uuid[], '  تنبيه  ', 'اجتماع بكرة'), 2);
select pg_temp.chk('stopped_account_gets_nothing',
  (select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-0000000000c1'), 0::bigint);
select pg_temp.chk('title_is_trimmed',
  (select title from public.notifications where user_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'message'), 'تنبيه');
select pg_temp.chk('empty_title_refused',
  pg_temp.try($q$select public.send_message(array['00000000-0000-0000-0000-0000000000b1']::uuid[], '   ', null)$q$), 'P0001');
select pg_temp.chk('long_title_refused',
  pg_temp.try(format($q$select public.send_message(array['00000000-0000-0000-0000-0000000000b1']::uuid[], %L, null)$q$, repeat('أ', 81))), 'P0001');
select pg_temp.chk('no_recipients_sends_nothing',
  public.send_message('{}'::uuid[], 'تنبيه', null), 0);

-- ===== the receiver sees it =====
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select pg_temp.chk('U_sees_the_message',
  (select count(*) from public.notifications where kind = 'message' and body = 'اجتماع بكرة'), 1::bigint);

select * from res;
rollback;
