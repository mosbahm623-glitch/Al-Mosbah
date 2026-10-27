-- Integration test for the live schema (permissions, approvals, custody access, totals).
-- Run in the Supabase SQL editor or via MCP execute_sql. It creates temporary users and rows,
-- prints one line per check (ok = got matches expected) and ALWAYS rolls back: nothing is kept.
begin;
create temp table res (k text, got text, expected text);
grant all on res to authenticated, anon;
create function pg_temp.chk(k text, got anyelement, expected anyelement) returns void language sql as
$f$ insert into res values (k, got::text, expected::text) $f$;
grant execute on function pg_temp.chk(text, anyelement, anyelement) to authenticated, anon;

-- people: admin (existing), P = projects editor, H = custody holder (advances editor), N = no permissions
insert into private.allowed_emails(email) values ('p@t.local'), ('h@t.local'), ('n@t.local');
insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p@t.local'),
  ('00000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','h@t.local'),
  ('00000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-000000000000','authenticated','authenticated','n@t.local');
update public.profiles set is_active = true where email in ('p@t.local','h@t.local','n@t.local');
insert into public.user_permissions values
  ('00000000-0000-0000-0000-00000000000a','projects','edit'),
  ('00000000-0000-0000-0000-00000000000b','advances','edit');

create temp table ids (admin uuid, pid uuid, adv1 uuid, adv2 uuid);
grant all on ids to authenticated;
insert into ids (admin) select id from public.profiles where role = 'admin' limit 1;

-- ===== as admin: project, income 1000, expense 300, two custodies =====
select set_config('role','authenticated',true);
select set_config('request.jwt.claims', json_build_object('sub',(select admin from ids),'role','authenticated')::text, true);
insert into public.projects(name, budget) values ('__T', 5000);
update ids set pid = (select id from public.projects where name = '__T');
insert into public.entries(project_id, kind, category, item, amount) select pid,'income','دفعة','x',1000 from ids;
insert into public.entries(project_id, kind, category, item, amount) select pid,'expense','كهربا','أسلاك',300 from ids;
insert into public.advances(holder_name) values ('__H1'), ('__H2');
update ids set adv1 = (select id from public.advances where holder_name='__H1'), adv2 = (select id from public.advances where holder_name='__H2');
insert into public.advance_installments(advance_id, amount) select adv1, 500 from ids;
insert into public.advance_installments(advance_id, amount) select adv2, 700 from ids;
insert into public.entries(project_id, advance_id, kind, category, item, amount) select pid, adv1,'expense','نثريات','x',120 from ids;
select pg_temp.chk('admin_entry_status', (select status from public.entries where item='أسلاك'), 'approved');
select pg_temp.chk('project_expenses', (select (x->>'expenses')::numeric from jsonb_array_elements(public.project_summaries()) x where x->>'id' = (select pid::text from ids)), 420::numeric);
select pg_temp.chk('dashboard_total_expenses_ge_420', ((public.dashboard_summary()->>'total_expenses')::numeric >= 420), true);
select pg_temp.chk('advance1_spent', (select (x->>'spent')::numeric from jsonb_array_elements(public.advance_summaries()) x where x->>'id' = (select adv1::text from ids)), 120::numeric);

-- ===== P: projects editor =====
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
insert into public.entries(project_id, kind, category, item, amount) select pid,'expense','سباكة','مواسير',80 from ids;
select pg_temp.chk('P_entry_pending', (select status from public.entries where item='مواسير'), 'pending');
select pg_temp.chk('P_pending_not_counted', (select (x->>'expenses')::numeric from jsonb_array_elements(public.project_summaries()) x where x->>'id' = (select pid::text from ids)), 420::numeric);
update public.entries set amount = 90 where item='مواسير';
select pg_temp.chk('P_edits_own_pending', (select amount from public.entries where item='مواسير'), 90::numeric);
update public.entries set status = 'approved' where item='مواسير';
select pg_temp.chk('P_cannot_self_approve', (select status from public.entries where item='مواسير'), 'pending');
update public.entries set amount = 1 where item='أسلاك';
select pg_temp.chk('P_cannot_edit_approved', (select amount from public.entries where item='أسلاك'), 300::numeric);
select pg_temp.chk('P_cannot_see_dashboard', public.dashboard_summary() is null, true);
select pg_temp.chk('P_cannot_see_banks', jsonb_array_length(public.bank_summaries()), 0);
select pg_temp.chk('P_sees_no_advances', (select count(*) from public.advances), 0::bigint);

-- ===== admin approves =====
select set_config('request.jwt.claims', json_build_object('sub',(select admin from ids),'role','authenticated')::text, true);
update public.entries set status = 'approved' where item='مواسير';
select pg_temp.chk('approved_counts', (select (x->>'expenses')::numeric from jsonb_array_elements(public.project_summaries()) x where x->>'id' = (select pid::text from ids)), 510::numeric);
select pg_temp.chk('decided_by_set', (select decided_by is not null from public.entries where item='مواسير'), true);
insert into public.user_advance_access select '00000000-0000-0000-0000-00000000000b', adv1 from ids;

-- ===== H: custody holder, access to custody 1 only =====
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select pg_temp.chk('H_sees_one_advance', (select count(*) from public.advances), 1::bigint);
select pg_temp.chk('H_sees_only_own_entries', (select count(*) from public.entries), 1::bigint);
select pg_temp.chk('H_sees_own_installments', (select count(*) from public.advance_installments), 1::bigint);
insert into public.entries(project_id, advance_id, kind, category, item, amount) select pid, adv1,'expense','نقل','x',10 from ids;
select pg_temp.chk('H_expense_pending', (select status from public.entries where item='x' and amount=10), 'pending');
do $$ begin
  begin insert into public.entries(project_id, advance_id, kind, category, item, amount) select pid, adv2,'expense','نقل','y',10 from ids; perform pg_temp.chk('H_expense_on_other_custody','ALLOWED'::text,'blocked'::text);
  exception when others then perform pg_temp.chk('H_expense_on_other_custody','blocked'::text,'blocked'::text); end;
  begin insert into public.advance_installments(advance_id, amount) select adv1, 1 from ids; perform pg_temp.chk('H_add_installment','ALLOWED'::text,'blocked'::text);
  exception when others then perform pg_temp.chk('H_add_installment','blocked'::text,'blocked'::text); end;
  begin insert into public.advances(holder_name) values ('__new'); perform pg_temp.chk('H_create_custody','ALLOWED'::text,'blocked'::text);
  exception when others then perform pg_temp.chk('H_create_custody','blocked'::text,'blocked'::text); end;
end $$;

-- ===== N: no permissions, and anon =====
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select pg_temp.chk('N_projects', (select count(*) from public.projects), 0::bigint);
select pg_temp.chk('N_entries', (select count(*) from public.entries), 0::bigint);
select pg_temp.chk('N_cannot_promote_self', (with u as (update public.profiles set role='admin' where id='00000000-0000-0000-0000-00000000000c' returning 1) select count(*) from u), 0::bigint);
select set_config('role','anon',true);
select pg_temp.chk('anon_projects', (select count(*) from public.projects), 0::bigint);
select set_config('role','postgres',true);

select k, got, expected, (got = expected or (got ~ '^-?[0-9.]+$' and expected ~ '^-?[0-9.]+$' and got::numeric = expected::numeric)) as ok
from res order by 4, k;
rollback;
