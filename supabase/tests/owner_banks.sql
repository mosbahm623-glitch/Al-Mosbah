-- Integration test for the banks an owner may choose (migrations 038, 039).
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

-- people: admin (existing), O = owner, U = plain user (projects editor)
insert into private.allowed_emails(email) values ('o@t.local'), ('u@t.local');
insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','o@t.local'),
  ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','u@t.local');
update public.profiles set is_active = true where email in ('o@t.local','u@t.local');
update public.profiles set role = 'owner' where email = 'o@t.local';
insert into public.user_permissions values ('00000000-0000-0000-0000-0000000000b1','projects','edit');

create temp table ids (admin uuid, pid uuid, bank_a uuid, bank_b uuid, eid uuid);
grant all on ids to authenticated;
insert into ids (admin) select id from public.profiles where role = 'admin' limit 1;

-- ===== admin: two banks, and the owner may choose only A =====
select set_config('role','authenticated',true);
select set_config('request.jwt.claims', json_build_object('sub',(select admin from ids),'role','authenticated')::text, true);
insert into public.projects(name, budget) values ('__OB', 0);
insert into public.bank_accounts(name) values ('__A'), ('__B');
update ids set pid = (select id from public.projects where name = '__OB'),
               bank_a = (select id from public.bank_accounts where name = '__A'),
               bank_b = (select id from public.bank_accounts where name = '__B');
insert into public.user_bank_access(user_id, bank_id) select '00000000-0000-0000-0000-0000000000a1', bank_a from ids;
insert into public.user_bank_access(user_id, bank_id) select '00000000-0000-0000-0000-0000000000b1', bank_b from ids;
select pg_temp.chk('admin_any_bank',
  pg_temp.try(format($q$insert into public.entries(project_id,kind,category,item,amount,bank_id) values (%L,'expense','مواد','x',10,%L)$q$, (select pid from ids), (select bank_b from ids))), 'ok');

-- ===== O: the owner =====
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select pg_temp.chk('O_expense_from_listed_bank',
  pg_temp.try(format($q$insert into public.entries(project_id,kind,category,item,amount,bank_id) values (%L,'expense','مواد','a',20,%L)$q$, (select pid from ids), (select bank_a from ids))), 'ok');
select pg_temp.chk('O_income_to_listed_bank',
  pg_temp.try(format($q$insert into public.entries(project_id,kind,category,amount,bank_id) values (%L,'income','دفعة',30,%L)$q$, (select pid from ids), (select bank_a from ids))), 'ok');
select pg_temp.chk('O_expense_from_other_bank_refused',
  pg_temp.try(format($q$insert into public.entries(project_id,kind,category,item,amount,bank_id) values (%L,'expense','مواد','b',40,%L)$q$, (select pid from ids), (select bank_b from ids))), 'P0001');
select pg_temp.chk('O_income_to_other_bank_refused',
  pg_temp.try(format($q$insert into public.entries(project_id,kind,category,amount,bank_id) values (%L,'income','دفعة',50,%L)$q$, (select pid from ids), (select bank_b from ids))), 'P0001');
select pg_temp.chk('O_entry_without_bank_refused',
  pg_temp.try(format($q$insert into public.entries(project_id,kind,category,item,amount) values (%L,'expense','مواد','c',60)$q$, (select pid from ids))), 'P0001');
select pg_temp.chk('O_income_without_bank_refused',
  pg_temp.try(format($q$insert into public.entries(project_id,kind,category,amount) values (%L,'income','دفعة',61)$q$, (select pid from ids))), 'P0001');
update ids set eid = (select id from public.entries where item = 'a');
-- edits go through edit_entry (it demands a reason), like the app does
select pg_temp.chk('O_edit_keeps_bank_ok',
  pg_temp.try(format($q$select public.edit_entry(%L, %s, 'سبب', %L::jsonb)$q$, (select eid from ids),
    (select rev from public.entries where id = (select eid from ids)),
    jsonb_build_object('project_id', (select pid from ids), 'kind', 'expense', 'category', 'مواد', 'item', 'a',
      'contractor_id', null, 'bank_id', (select bank_a from ids), 'amount', 20, 'entry_date', current_date, 'notes', 'n')::text)), 'ok');
select pg_temp.chk('O_switch_to_other_bank_refused',
  pg_temp.try(format($q$select public.edit_entry(%L, %s, 'سبب', %L::jsonb)$q$, (select eid from ids),
    (select rev from public.entries where id = (select eid from ids)),
    jsonb_build_object('project_id', (select pid from ids), 'kind', 'expense', 'category', 'مواد', 'item', 'a',
      'contractor_id', null, 'bank_id', (select bank_b from ids), 'amount', 20, 'entry_date', current_date, 'notes', 'n')::text)), 'P0001');
select pg_temp.chk('O_cannot_add_own_bank',
  pg_temp.try(format($q$insert into public.user_bank_access(user_id, bank_id) values ('00000000-0000-0000-0000-0000000000a1', %L)$q$, (select bank_b from ids))), '42501');
delete from public.user_bank_access where user_id = '00000000-0000-0000-0000-0000000000a1';
select pg_temp.chk('O_cannot_remove_own_limit', (select count(*) from public.user_bank_access), 1::bigint);

-- ===== U: a plain user is not limited =====
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select pg_temp.chk('U_not_limited',
  pg_temp.try(format($q$insert into public.entries(project_id,kind,category,item,amount,bank_id) values (%L,'expense','مواد','u',70,%L)$q$, (select pid from ids), (select bank_a from ids))), 'ok');

-- ===== income needs a bank for everyone (migration 041); an expense does not, for a plain user =====
select pg_temp.chk('U_income_without_bank_refused',
  pg_temp.try(format($q$insert into public.entries(project_id,kind,category,amount) values (%L,'income','دفعة',71)$q$, (select pid from ids))), 'P0001');
select pg_temp.chk('U_income_with_bank_ok',
  pg_temp.try(format($q$insert into public.entries(project_id,kind,category,amount,bank_id) values (%L,'income','دفعة',72,%L)$q$, (select pid from ids), (select bank_a from ids))), 'ok');
select pg_temp.chk('U_expense_without_bank_ok',
  pg_temp.try(format($q$insert into public.entries(project_id,kind,category,item,amount) values (%L,'expense','مواد','nb',73)$q$, (select pid from ids))), 'ok');
select set_config('request.jwt.claims', json_build_object('sub',(select admin from ids),'role','authenticated')::text, true);
select pg_temp.chk('admin_income_without_bank_refused',
  pg_temp.try(format($q$insert into public.entries(project_id,kind,category,amount) values (%L,'income','دفعة',74)$q$, (select pid from ids))), 'P0001');

-- ===== admin: wiping the banks takes the lists with it =====
select public.reset_data(array['entries', 'contractor_dues', 'banks']);
select pg_temp.chk('reset_banks_clears_lists', (select count(*) from public.user_bank_access), 0::bigint);

select k, got, expected, case when got = expected then 'ok' else 'FAIL' end as result from res;
rollback;
