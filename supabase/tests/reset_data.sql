-- Integration test for reset_data(). Prints one row per check and ALWAYS rolls back.
begin;
create temp table res (k text, got text, expected text);
create function pg_temp.chk(k text, got anyelement, expected anyelement) returns void language sql as
$f$ insert into res values (k, got::text, expected::text) $f$;

create temp table ids (admin uuid, pid uuid);
insert into ids (admin) select id from public.profiles where role = 'admin' and is_active limit 1;
insert into public.projects(name, budget) values ('__RESET', 0);
update ids set pid = (select id from public.projects where name = '__RESET');
insert into public.entries(project_id, kind, category, item, amount) select pid, 'income', 'دفعة', 'x', 100 from ids;
create temp table kept as select (select count(*) from public.profiles) profiles, (select count(*) from public.user_permissions) perms;

-- nobody signed in: refused, nothing is touched
do $$
begin
  perform public.reset_data();
  insert into res values ('refused_without_admin', 'no error', 'error');
exception when insufficient_privilege then
  insert into res values ('refused_without_admin', 'error', 'error');
end $$;
select pg_temp.chk('entries_survive_refusal', (select count(*) from public.entries where item = 'x' and project_id = (select pid from ids)), 1::bigint);

-- the admin resets
select set_config('request.jwt.claims', json_build_object('sub', (select admin from ids), 'role', 'authenticated')::text, true);
select public.reset_data();
select pg_temp.chk('entries_cleared', (select count(*) from public.entries), 0::bigint);
select pg_temp.chk('projects_cleared', (select count(*) from public.projects), 0::bigint);
select pg_temp.chk('counters_cleared', (select count(*) from public.entry_counters), 0::bigint);
select pg_temp.chk('profiles_kept', (select count(*) from public.profiles), (select profiles from kept));
select pg_temp.chk('permissions_kept', (select count(*) from public.user_permissions), (select perms from kept));

select k, got, expected, case when got = expected then 'ok' else 'FAIL' end as result from res;
rollback;
