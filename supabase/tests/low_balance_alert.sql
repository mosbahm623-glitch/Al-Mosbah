-- Integration test for the low-balance alert. Prints one row per check and ALWAYS rolls back.
begin;
create temp table res (k text, got text, expected text);
create function pg_temp.chk(k text, got anyelement, expected anyelement) returns void language sql as
$f$ insert into res values (k, got::text, expected::text) $f$;

create temp table ids (admin uuid, pid uuid);
-- the alert goes to owners (not admins): make the ordinary seed user an owner for this test
update public.profiles set role = 'owner' where email = 'user@test.local';
insert into ids (admin) select id from public.profiles where email = 'user@test.local';
insert into public.bank_accounts(name) values ('__LBB');
insert into public.projects(name, budget) values ('__LB', 0);
update ids set pid = (select id from public.projects where name = '__LB');
create temp table base as select count(*) c from public.notifications where kind = 'low_balance';

-- 100,000 in: above threshold, no alert
insert into public.entries(project_id, kind, category, item, amount, bank_id) select pid,'income','دفعة','x',100000,(select id from public.bank_accounts where name = '__LBB') from ids;
select pg_temp.chk('no_alert_above', (select count(*) from public.notifications where kind='low_balance') - (select c from base), 0::bigint);
-- 60,000 out: balance 40,000 -> alert once
insert into public.entries(project_id, kind, category, item, amount, bank_id) select pid,'expense','مواد','x',60000,(select id from public.bank_accounts where name = '__LBB') from ids;
select pg_temp.chk('alert_on_crossing', (select count(*) from public.notifications where kind='low_balance' and body like '%__LB%' and user_id=(select admin from ids)), 1::bigint);
-- another expense while still below: no second alert
insert into public.entries(project_id, kind, category, item, amount, bank_id) select pid,'expense','مواد','x',1000,(select id from public.bank_accounts where name = '__LBB') from ids;
select pg_temp.chk('no_repeat_while_below', (select count(*) from public.notifications where kind='low_balance' and body like '%__LB%' and user_id=(select admin from ids)), 1::bigint);
-- income brings it back up, then a drop alerts again
insert into public.entries(project_id, kind, category, item, amount, bank_id) select pid,'income','دفعة','x',50000,(select id from public.bank_accounts where name = '__LBB') from ids;
insert into public.entries(project_id, kind, category, item, amount, bank_id) select pid,'expense','مواد','x',50000,(select id from public.bank_accounts where name = '__LBB') from ids;
select pg_temp.chk('re_arms_after_recovery', (select count(*) from public.notifications where kind='low_balance' and body like '%__LB%' and user_id=(select admin from ids)), 2::bigint);
-- an admin who is not an owner gets nothing
insert into public.entries(project_id, kind, category, item, amount, bank_id) select pid,'income','دفعة','x',100000,(select id from public.bank_accounts where name = '__LBB') from ids;
insert into public.entries(project_id, kind, category, item, amount, bank_id) select pid,'expense','مواد','x',100000,(select id from public.bank_accounts where name = '__LBB') from ids;
select pg_temp.chk('admin_gets_none', (select count(*) from public.notifications where kind='low_balance' and body like '%__LB%' and user_id in (select id from public.profiles where role = 'admin')), 0::bigint);

select k, got, expected, case when got = expected then 'ok' else 'FAIL' end as result from res;
rollback;
