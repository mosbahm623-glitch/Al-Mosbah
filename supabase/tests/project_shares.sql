-- Integration test for the client share link (migration 066).
-- Run in the Supabase SQL editor or via MCP execute_sql. It creates temporary rows,
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

create temp table ids (admin uuid, pid uuid, other uuid, bank uuid, share uuid, tok text);
grant all on ids to authenticated, anon;
insert into ids (admin) select id from public.profiles where role = 'admin' limit 1;

-- ===== admin: a project with approved, pending and deleted entries, and a second project =====
select set_config('role','authenticated',true);
select set_config('request.jwt.claims', json_build_object('sub',(select admin from ids),'role','authenticated')::text, true);
insert into public.projects(name, budget) values ('__SHARE', 0), ('__OTHER', 0);
insert into public.bank_accounts(name) values ('__SB');
update ids set pid = (select id from public.projects where name = '__SHARE'),
               other = (select id from public.projects where name = '__OTHER'),
               bank = (select id from public.bank_accounts where name = '__SB');
insert into public.entries(project_id, kind, category, item, amount, notes, bank_id) select pid, 'income', 'دفعة', null, 1000, 'سري-ملاحظة', bank from ids;
insert into public.entries(project_id, kind, category, item, amount, notes, bank_id) select pid, 'expense', 'نجارة', 'أبواب', 300, 'سري-ملاحظة', bank from ids;
insert into public.entries(project_id, kind, category, item, amount, bank_id) select pid, 'expense', 'كهرباء', 'كابلات', 100, bank from ids;
insert into public.entries(project_id, kind, category, item, amount, bank_id) select other, 'expense', 'نجارة', 'مشروع تاني', 7777, bank from ids;
-- a pending and a deleted entry must never reach the client
update public.entries set status = 'pending' where item = 'كابلات';
insert into public.entries(project_id, kind, category, item, amount, bank_id) select pid, 'expense', 'سباكة', 'محذوف', 55, bank from ids;
select public.delete_entry(id, rev, 'اختبار') from public.entries where item = 'محذوف';

insert into public.project_shares(project_id) select pid from ids;
update ids set share = (select id from public.project_shares where project_id = (select pid from ids)),
               tok = (select token from public.project_shares where project_id = (select pid from ids));
select pg_temp.chk('admin_reads_shares', (select count(*)::int from public.project_shares), 1);

-- ===== anonymous visitor =====
select set_config('role','anon',true);
select set_config('request.jwt.claims','{"role":"anon"}', true);
select pg_temp.chk('anon_cannot_read_table', pg_temp.try('select * from public.project_shares'), '42501');
select pg_temp.chk('anon_cannot_insert_share', pg_temp.try(format($q$insert into public.project_shares(project_id) values (%L)$q$, (select pid from ids))), '42501');
select pg_temp.chk('anon_sees_no_entries', (select count(*)::int from public.entries), 0);
select pg_temp.chk('wrong_token_gives_null', (public.shared_project('nope') is null)::text, 'true');
select pg_temp.chk('token_gives_project', public.shared_project((select tok from ids)) ->> 'name', '__SHARE');
select pg_temp.chk('income_total', (public.shared_project((select tok from ids)) ->> 'income')::numeric, 1000.00::numeric);
select pg_temp.chk('expense_total_counts_only_approved', (public.shared_project((select tok from ids)) ->> 'expenses')::numeric, 300.00::numeric);
select pg_temp.chk('entries_count_excludes_pending_and_deleted', jsonb_array_length(public.shared_project((select tok from ids)) -> 'entries'), 2);
select pg_temp.chk('categories_listed', public.shared_project((select tok from ids)) -> 'categories' -> 0 ->> 'category', 'نجارة');
select pg_temp.chk('other_project_not_leaked', (public.shared_project((select tok from ids))::text like '%7777%')::text, 'false');
select pg_temp.chk('notes_not_leaked', (public.shared_project((select tok from ids))::text like '%سري%')::text, 'false');
select pg_temp.chk('entry_has_no_hidden_keys',
  (select string_agg(k, ',' order by k) from jsonb_object_keys(public.shared_project((select tok from ids)) -> 'entries' -> 0) k),
  'amount,category,entry_date,item,kind,seq');

-- ===== admin revokes, and the link dies =====
select set_config('role','authenticated',true);
select set_config('request.jwt.claims', json_build_object('sub',(select admin from ids),'role','authenticated')::text, true);
update public.project_shares set revoked_at = now() where id = (select share from ids);
select set_config('role','anon',true);
select set_config('request.jwt.claims','{"role":"anon"}', true);
select pg_temp.chk('revoked_link_gives_null', (public.shared_project((select tok from ids)) is null)::text, 'true');

-- ===== an expired link dies too =====
select set_config('role','authenticated',true);
select set_config('request.jwt.claims', json_build_object('sub',(select admin from ids),'role','authenticated')::text, true);
update public.project_shares set revoked_at = null, expires_at = now() - interval '1 minute' where id = (select share from ids);
select set_config('role','anon',true);
select set_config('request.jwt.claims','{"role":"anon"}', true);
select pg_temp.chk('expired_link_gives_null', (public.shared_project((select tok from ids)) is null)::text, 'true');

-- ===== an ordinary user cannot create or read links =====
select set_config('role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
select pg_temp.chk('user_sees_no_shares', (select count(*)::int from public.project_shares), 0);
select pg_temp.chk('user_cannot_create_share', pg_temp.try(format($q$insert into public.project_shares(project_id) values (%L)$q$, (select pid from ids))), '42501');

select k, got, expected, case when got = expected then 'ok' else 'FAIL' end as result from res;
rollback;
