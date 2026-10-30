-- Integration test for the low-balance alert. Prints one row per check and ALWAYS rolls back.
begin;
create temp table res (k text, got text, expected text);
create function pg_temp.chk(k text, got anyelement, expected anyelement) returns void language sql as
$f$ insert into res values (k, got::text, expected::text) $f$;

create temp table ids (admin uuid, pid uuid);
insert into ids (admin) select id from public.profiles where role = 'admin' and is_active limit 1;
update public.profiles set notify_low_balance = true where id = (select admin from ids);
insert into public.projects(name, budget) values ('__LB', 0);
update ids set pid = (select id from public.projects where name = '__LB');
create temp table base as select count(*) c from public.notifications where kind = 'low_balance';

-- 100,000 in: above threshold, no alert
insert into public.entries(project_id, kind, category, item, amount) select pid,'income','دفعة','x',100000 from ids;
select pg_temp.chk('no_alert_above', (select count(*) from public.notifications where kind='low_balance') - (select c from base), 0::bigint);
-- 60,000 out: balance 40,000 -> alert once
insert into public.entries(project_id, kind, category, item, amount) select pid,'expense','مواد','x',60000 from ids;
select pg_temp.chk('alert_on_crossing', (select count(*) from public.notifications where kind='low_balance' and body like '%__LB%' and user_id=(select admin from ids)), 1::bigint);
-- another expense while still below: no second alert
insert into public.entries(project_id, kind, category, item, amount) select pid,'expense','مواد','x',1000 from ids;
select pg_temp.chk('no_repeat_while_below', (select count(*) from public.notifications where kind='low_balance' and body like '%__LB%' and user_id=(select admin from ids)), 1::bigint);
-- income brings it back up, then a drop alerts again
insert into public.entries(project_id, kind, category, item, amount) select pid,'income','دفعة','x',50000 from ids;
insert into public.entries(project_id, kind, category, item, amount) select pid,'expense','مواد','x',50000 from ids;
select pg_temp.chk('re_arms_after_recovery', (select count(*) from public.notifications where kind='low_balance' and body like '%__LB%' and user_id=(select admin from ids)), 2::bigint);
-- a user who is not ticked gets nothing
update public.profiles set notify_low_balance = false where id = (select admin from ids);
insert into public.entries(project_id, kind, category, item, amount) select pid,'income','دفعة','x',100000 from ids;
insert into public.entries(project_id, kind, category, item, amount) select pid,'expense','مواد','x',100000 from ids;
select pg_temp.chk('unticked_gets_none', (select count(*) from public.notifications where kind='low_balance' and body like '%__LB%' and user_id=(select admin from ids)), 2::bigint);

select k, got, expected, case when got = expected then 'ok' else 'FAIL' end as result from res;
rollback;
