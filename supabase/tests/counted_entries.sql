-- Integration test: only approved, not-deleted entries are counted, in every total.
-- Same style as rls_and_totals.sql: prints one line per check and ALWAYS rolls back.
begin;
create temp table res (k text, got text, expected text);
grant all on res to authenticated, anon;
create function pg_temp.chk(k text, got anyelement, expected anyelement) returns void language sql as
$f$ insert into res values (k, got::text, expected::text) $f$;
grant execute on function pg_temp.chk(text, anyelement, anyelement) to authenticated, anon;

create temp table ids (admin uuid, pid uuid, bank uuid);
grant all on ids to authenticated;
insert into ids (admin) select id from public.profiles where role = 'admin' limit 1;

select set_config('role','authenticated',true);
select set_config('request.jwt.claims', json_build_object('sub',(select admin from ids),'role','authenticated')::text, true);
insert into public.projects(name, budget) values ('__CE', 5000);
insert into public.bank_accounts(name) values ('__CEB');
update ids set pid = (select id from public.projects where name = '__CE'), bank = (select id from public.bank_accounts where name = '__CEB');

-- admin entries are approved at once: income 1000, expense 300, and a refund (negative expense) of 50
insert into public.entries(project_id, kind, category, item, amount, bank_id) select pid,'income','دفعة','x',1000,bank from ids;
insert into public.entries(project_id, kind, category, item, amount, bank_id) select pid,'expense','كهربا','أسلاك',300,bank from ids;
insert into public.entries(project_id, kind, category, item, amount, bank_id) select pid,'expense','كهربا','مرتجع أسلاك',-50,bank from ids;
-- a pending one must stay out of every total (an admin's own entry is approved at once, so it is set back to pending)
insert into public.entries(project_id, kind, category, item, amount, bank_id) select pid,'expense','سباكة','معلّق',999,bank from ids;
-- a deleted one too
insert into public.entries(project_id, kind, category, item, amount, bank_id) select pid,'expense','سباكة','هيتمسح',777,bank from ids;
select public.delete_entry(id, rev, 'اختبار') from public.entries where item = 'هيتمسح';
select set_config('role','postgres',true);
update public.entries set status = 'pending' where item = 'معلّق';
select set_config('role','authenticated',true);

select pg_temp.chk('counted_rows', (select count(*) from private.counted_entries e join ids on e.project_id = ids.pid), 3::bigint);
select pg_temp.chk('project_income', (select (x->>'income')::numeric from jsonb_array_elements(public.project_summaries()) x where x->>'id' = (select pid::text from ids)), 1000::numeric);
select pg_temp.chk('project_expenses_net_of_refund', (select (x->>'expenses')::numeric from jsonb_array_elements(public.project_summaries()) x where x->>'id' = (select pid::text from ids)), 250::numeric);
select pg_temp.chk('bank_expenses_net_of_refund', (select (x->>'expenses')::numeric from jsonb_array_elements(public.bank_summaries()) x where x->>'id' = (select bank::text from ids)), 250::numeric);
select pg_temp.chk('bank_movements_rows', (select jsonb_array_length(public.bank_movements((select bank from ids)))), 3);
select set_config('role','postgres',true);
select pg_temp.chk('anon_cannot_read_view', has_table_privilege('anon','private.counted_entries','select'), false);
select pg_temp.chk('project_balance', (select private.project_balance(pid) from ids), 750::numeric);

select k, got, expected, (got = expected or (got ~ '^-?[0-9.]+$' and expected ~ '^-?[0-9.]+$' and got::numeric = expected::numeric)) as ok
from res order by 4, k;
rollback;
