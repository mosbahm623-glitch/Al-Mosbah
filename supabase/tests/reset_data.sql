-- Integration test for reset_data(p_groups). Prints one row per check and ALWAYS rolls back.
begin;
create temp table res (k text, got text, expected text);
create function pg_temp.chk(k text, got anyelement, expected anyelement) returns void language sql as
$f$ insert into res values (k, got::text, expected::text) $f$;
-- runs a call that must fail and records the SQLSTATE
create function pg_temp.fails(k text, groups text[], expected text) returns void language plpgsql as
$f$
begin
  begin
    perform public.reset_data(groups);
    insert into res values (k, 'no error', expected);
  exception when others then
    insert into res values (k, sqlstate, expected);
  end;
end;
$f$;

create temp table ids (admin uuid, pid uuid);
insert into ids (admin) select id from public.profiles where role = 'admin' and is_active limit 1;
insert into public.expense_categories(name) values ('__RESET_CAT');
insert into public.projects(name, budget) values ('__RESET', 0);
update ids set pid = (select id from public.projects where name = '__RESET');
insert into public.entries(project_id, kind, category, item, amount) select pid, 'income', 'دفعة', 'x', 100 from ids;
create temp table kept as select (select count(*) from public.profiles) profiles, (select count(*) from public.user_permissions) perms;

-- nobody signed in: refused, nothing is touched
select pg_temp.fails('refused_without_admin', array['categories'], '42501');
select pg_temp.chk('category_survives_refusal', (select count(*) from public.expense_categories where name = '__RESET_CAT'), 1::bigint);

select set_config('request.jwt.claims', json_build_object('sub', (select admin from ids), 'role', 'authenticated')::text, true);

-- bad selections
select pg_temp.fails('empty_selection', array[]::text[], '22023');
select pg_temp.fails('unknown_group', array['nope'], '22023');
select pg_temp.fails('projects_need_entries', array['projects'], '22023');
select pg_temp.fails('contractors_need_entries', array['contractors', 'entries'], '22023');
select pg_temp.fails('advances_need_entries', array['advances'], '22023');
select pg_temp.fails('users_need_the_rest', array['users', 'entries'], '22023');
select pg_temp.chk('nothing_deleted_by_refusals', (select count(*) from public.projects where name = '__RESET'), 1::bigint);

-- only the categories
select public.reset_data(array['categories']);
select pg_temp.chk('categories_cleared', (select count(*) from public.expense_categories), 0::bigint);
select pg_temp.chk('entries_untouched', (select count(*) from public.entries), 1::bigint);
select pg_temp.chk('projects_untouched', (select count(*) from public.projects where name = '__RESET'), 1::bigint);

-- the default (no argument) is all the data and never the users
select public.reset_data();
select pg_temp.chk('entries_cleared', (select count(*) from public.entries), 0::bigint);
select pg_temp.chk('projects_cleared', (select count(*) from public.projects), 0::bigint);
select pg_temp.chk('counters_cleared', (select count(*) from public.entry_counters), 0::bigint);
select pg_temp.chk('profiles_kept', (select count(*) from public.profiles), (select profiles from kept));
select pg_temp.chk('permissions_kept', (select count(*) from public.user_permissions), (select perms from kept));

-- users: every account but the admin's own goes, and the e-mails leave the sign-up list
select public.reset_data(array['entries', 'contractor_dues', 'advances', 'users']);
select pg_temp.chk('only_admin_account_left', (select count(*) from auth.users), 1::bigint);
select pg_temp.chk('admin_account_is_the_one_kept', (select id from auth.users limit 1), (select admin from ids));
select pg_temp.chk('only_admin_profile_left', (select count(*) from public.profiles), 1::bigint);
select pg_temp.chk('admin_email_stays_listed',
  (select count(*) from private.allowed_emails where email = (select lower(email) from auth.users limit 1)), 1::bigint);

select k, got, expected, case when got = expected then 'ok' else 'FAIL' end as result from res;
rollback;
