-- Integration test for merging contractor names (migration 071). Prints one line per check; ALWAYS rolls back.
begin;
create temp table res (k text, got text, expected text);
grant all on res to authenticated, anon;
create function pg_temp.chk(k text, got anyelement, expected anyelement) returns void language sql as
$f$ insert into res values (k, got::text, expected::text) $f$;
grant execute on function pg_temp.chk(text, anyelement, anyelement) to authenticated, anon;

insert into private.allowed_emails(email) values ('o@t.local');
insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','o@t.local');
update public.profiles set is_active = true, role = 'owner' where email = 'o@t.local';

create temp table ids (admin uuid, pid uuid, bank uuid, k uuid, d1 uuid, d2 uuid, e uuid);
grant all on ids to authenticated;
insert into ids (admin) select id from public.profiles where role = 'admin' limit 1;

select set_config('role','authenticated',true);
select set_config('request.jwt.claims', json_build_object('sub',(select admin from ids),'role','authenticated')::text, true);
insert into public.projects(name, budget) values ('__MC', 1000);
insert into public.bank_accounts(name) values ('__MCB');
insert into public.contractors(name) values ('__KEEP'), ('__DUP1'), ('__DUP2');
update ids set pid = (select id from public.projects where name = '__MC'),
  bank = (select id from public.bank_accounts where name = '__MCB'),
  k = (select id from public.contractors where name = '__KEEP'),
  d1 = (select id from public.contractors where name = '__DUP1'),
  d2 = (select id from public.contractors where name = '__DUP2');
insert into public.entries(project_id,kind,category,item,amount,contractor_id,bank_id) select pid,'expense','مواد','بيان-1',10,k,bank from ids;
insert into public.entries(project_id,kind,category,item,amount,contractor_id,bank_id) select pid,'expense','مواد','بيان-2',20,d1,bank from ids;
insert into public.entries(project_id,kind,category,item,amount,contractor_id,bank_id) select pid,'expense','مواد','بيان-3',30,d2,bank from ids;
insert into public.contractor_transactions(contractor_id,project_id,kind,amount) select d1,pid,'due',500 from ids;
insert into public.contractor_transactions(contractor_id,project_id,kind,amount) select d2,pid,'payment',200 from ids;
select pg_temp.chk('approved_before', (select count(*) from public.entries where project_id = (select pid from ids) and status = 'approved'), 3::bigint);

-- ===== an owner cannot merge =====
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
do $$ begin
  begin perform public.merge_contractors((select k from ids), array[(select d1 from ids)]); perform pg_temp.chk('owner_cannot_merge','ALLOWED'::text,'blocked'::text);
  exception when others then perform pg_temp.chk('owner_cannot_merge','blocked'::text,'blocked'::text); end;
end $$;
select set_config('request.jwt.claims', json_build_object('sub',(select admin from ids),'role','authenticated')::text, true);

-- ===== bad input =====
do $$ begin
  begin perform public.merge_contractors((select k from ids), array[(select k from ids)]); perform pg_temp.chk('merge_into_itself','ALLOWED'::text,'blocked'::text);
  exception when others then perform pg_temp.chk('merge_into_itself','blocked'::text,'blocked'::text); end;
  begin perform public.merge_contractors((select k from ids), array['00000000-0000-0000-0000-00000000dead'::uuid]); perform pg_temp.chk('unknown_contractor','ALLOWED'::text,'blocked'::text);
  exception when others then perform pg_temp.chk('unknown_contractor','blocked'::text,'blocked'::text); end;
end $$;

-- ===== the real merge =====
update ids set e = (select id from public.entries where item = 'بيان-2');
select public.merge_contractors((select k from ids), array[(select d1 from ids), (select d2 from ids)]);
select pg_temp.chk('entries_all_on_keep', (select count(*) from public.entries where project_id = (select pid from ids) and contractor_id = (select k from ids)), 3::bigint);
select pg_temp.chk('txns_all_on_keep', (select count(*) from public.contractor_transactions where contractor_id = (select k from ids)), 2::bigint);
select pg_temp.chk('dups_removed', (select count(*) from public.contractors where name in ('__DUP1','__DUP2')), 0::bigint);
select pg_temp.chk('keep_remains', (select count(*) from public.contractors where id = (select k from ids)), 1::bigint);
select pg_temp.chk('entries_still_approved', (select count(*) from public.entries where project_id = (select pid from ids) and status = 'approved'), 3::bigint);
select pg_temp.chk('amounts_and_items_untouched', (select string_agg(item || ':' || amount::text, ',' order by item) from public.entries where project_id = (select pid from ids)), 'بيان-1:10.00,بيان-2:20.00,بيان-3:30.00');
select pg_temp.chk('edit_reason_recorded', (select edit_reason like 'دمج مقاولين%' from public.entries where id = (select e from ids)), true);
select set_config('role','postgres',true);

select k, got, expected, (got = expected or (got ~ '^-?[0-9.]+$' and expected ~ '^-?[0-9.]+$' and got::numeric = expected::numeric)) as ok
from res order by 4, k;
rollback;
