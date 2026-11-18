-- Integration test: an ordinary user cannot raise his own rights, approve entries, or read admin-only data.
-- Prints one line per check (as an error message, so nothing is kept) and ALWAYS rolls back.
begin;
create temp table res (k text, got text, expected text);
grant all on res to authenticated, anon;
-- runs a statement as the current role: how many rows it changed, or 'denied' when the database refuses it
create function pg_temp.try(q text) returns text language plpgsql as
$f$ declare n bigint; begin execute q; get diagnostics n = row_count; return n::text;
exception when others then return 'denied'; end $f$;
grant execute on function pg_temp.try(text) to authenticated, anon;
create function pg_temp.chk(k text, got text, expected text) returns void language sql as
$f$ insert into res values (k, got, expected) $f$;
grant execute on function pg_temp.chk(text, text, text) to authenticated, anon;

create temp table ids (admin uuid, usr uuid, pid uuid, bank uuid, eid uuid);
grant all on ids to authenticated;
insert into ids (admin, usr) select (select id from public.profiles where role = 'admin' limit 1), (select id from public.profiles where role = 'user' limit 1);
-- the plain user starts with no page rights at all
delete from public.user_permissions where user_id = (select usr from ids);

select set_config('role','authenticated',true);
select set_config('request.jwt.claims', json_build_object('sub',(select admin from ids),'role','authenticated')::text, true);
insert into public.projects(name, budget) values ('__RLS', 1000);
insert into public.bank_accounts(name) values ('__RLSB');
update ids set pid = (select id from public.projects where name = '__RLS'), bank = (select id from public.bank_accounts where name = '__RLSB');
insert into public.entries(project_id, kind, category, item, amount, bank_id) select pid,'expense','كهربا','x',100,bank from ids;
update ids set eid = (select id from public.entries where item = 'x' and project_id = (select pid from ids));

-- now as the plain user
select set_config('request.jwt.claims', json_build_object('sub',(select usr from ids),'role','authenticated')::text, true);
select pg_temp.chk('user_sees_no_entries_without_rights', pg_temp.try('select 1 from public.entries where item = ''x'' having count(*) > 0'), '0');
select pg_temp.chk('user_cannot_grant_himself_a_page', pg_temp.try(format('insert into public.user_permissions(user_id, module, level) values (%L, ''projects'', ''edit'')', (select usr from ids))), 'denied');
select pg_temp.chk('user_cannot_become_admin', pg_temp.try(format('update public.profiles set role = ''admin'' where id = %L', (select usr from ids))), '0');
select pg_temp.chk('user_cannot_approve_an_entry', pg_temp.try(format('update public.entries set status = ''approved'' where id = %L', (select eid from ids))), '0');
select pg_temp.chk('user_cannot_read_backup_log', pg_temp.try('select 1 from public.backup_log having count(*) > 0'), '0');
select pg_temp.chk('user_cannot_write_backup_log', pg_temp.try(format('insert into public.backup_log(by, note) values (%L, ''x'')', (select usr from ids))), 'denied');
select pg_temp.chk('user_cannot_create_a_bank_without_rights', pg_temp.try('insert into public.bank_accounts(name) values (''__nope'')'), 'denied');

-- a signed-out visitor sees and changes nothing
select set_config('role','anon',true);
select set_config('request.jwt.claims', '', true);
select pg_temp.chk('anon_reads_no_entries', pg_temp.try('select 1 from public.entries having count(*) > 0'), '0');
select pg_temp.chk('anon_cannot_insert_a_project', pg_temp.try('insert into public.projects(name, budget) values (''__anon'', 1)'), 'denied');

select set_config('role','postgres',true);
do $d$ declare r text; begin
  select string_agg(k || ' ' || (case when got = expected then 'ok' else 'FAIL got=' || got || ' expected=' || expected end), E'\n' order by k) into r from res;
  raise exception E'RESULTS\n%', r;
end $d$;
