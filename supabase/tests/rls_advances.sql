-- Integration test: custody, contractor and bank-transfer rights of an ordinary user.
-- Prints one line per check (as an error message, so nothing is kept) and ALWAYS rolls back.
begin;
create temp table res (k text, got text, expected text);
grant all on res to authenticated, anon;
create function pg_temp.try(q text) returns text language plpgsql as
$f$ declare n bigint; begin execute q; get diagnostics n = row_count; return n::text;
exception when others then return 'denied'; end $f$;
grant execute on function pg_temp.try(text) to authenticated, anon;
create function pg_temp.chk(k text, got text, expected text) returns void language sql as
$f$ insert into res values (k, got, expected) $f$;
grant execute on function pg_temp.chk(text, text, text) to authenticated, anon;

create temp table ids (admin uuid, usr uuid, adv uuid, adv2 uuid, con uuid, bank uuid);
grant all on ids to authenticated;
insert into ids (admin, usr) select (select id from public.profiles where role = 'admin' limit 1), (select id from public.profiles where role = 'user' limit 1);
-- the plain user may only look at custody and contractors, nothing else
delete from public.user_permissions where user_id = (select usr from ids);
delete from public.user_advance_access where user_id = (select usr from ids);
insert into public.user_permissions(user_id, module, level) select usr, 'advances', 'view' from ids;
insert into public.user_permissions(user_id, module, level) select usr, 'contractors', 'view' from ids;

select set_config('role','authenticated',true);
select set_config('request.jwt.claims', json_build_object('sub',(select admin from ids),'role','authenticated')::text, true);
insert into public.advances(holder_name) values ('__ADV1'), ('__ADV2');
insert into public.contractors(name) values ('__CON');
insert into public.bank_accounts(name) values ('__B');
update ids set bank = (select id from public.bank_accounts where name = '__B'), adv = (select id from public.advances where holder_name = '__ADV1'), adv2 = (select id from public.advances where holder_name = '__ADV2'), con = (select id from public.contractors where name = '__CON');
-- the same writes work for the admin, so a refusal below is the rights, not a wrong column
select pg_temp.chk('control_admin_adds_a_return', pg_temp.try(format('insert into public.advance_returns(advance_id, amount, returned_on) values (%L, 100, current_date)', (select adv from ids))), '1');
select pg_temp.chk('control_admin_adds_a_payment', pg_temp.try(format('insert into public.advance_installments(advance_id, amount, paid_on, bank_id) values (%L, 100, current_date, %L)', (select adv from ids), (select bank from ids))), '1');
select pg_temp.chk('control_admin_adds_a_contractor_payment', pg_temp.try(format('insert into public.contractor_transactions(contractor_id, kind, amount, txn_date) values (%L, ''payment'', 100, current_date)', (select con from ids))), '1');
select set_config('role','postgres',true);
-- he is given the first custody only
insert into public.user_advance_access(user_id, advance_id) select usr, adv from ids;

select set_config('role','authenticated',true);
select set_config('request.jwt.claims', json_build_object('sub',(select usr from ids),'role','authenticated')::text, true);
select pg_temp.chk('sees_his_custody', (select count(*)::text from public.advances where id = (select adv from ids)), '1');
select pg_temp.chk('does_not_see_other_custody', (select count(*)::text from public.advances where id = (select adv2 from ids)), '0');
select pg_temp.chk('cannot_create_a_custody', pg_temp.try('insert into public.advances(holder_name) values (''__no'')'), 'denied');
select pg_temp.chk('cannot_add_a_custody_payment', pg_temp.try(format('insert into public.advance_installments(advance_id, amount, paid_on, bank_id) values (%L, 100, current_date, %L)', (select adv from ids), (select bank from ids))), 'denied');
select pg_temp.chk('cannot_add_a_custody_return', pg_temp.try(format('insert into public.advance_returns(advance_id, amount, returned_on) values (%L, 100, current_date)', (select adv from ids))), 'denied');
select pg_temp.chk('cannot_close_a_custody', pg_temp.try(format('update public.advances set status = ''closed'' where id = %L', (select adv from ids))), '0');
select pg_temp.chk('sees_contractors_with_view', (select count(*)::text from public.contractors where id = (select con from ids)), '1');
select pg_temp.chk('cannot_add_a_contractor_payment', pg_temp.try(format('insert into public.contractor_transactions(contractor_id, kind, amount, txn_date) values (%L, ''payment'', 100, current_date)', (select con from ids))), 'denied');
select pg_temp.chk('cannot_see_bank_transfers', pg_temp.try('select 1 from public.bank_transfers having count(*) > 0'), '0');

select set_config('role','postgres',true);
do $d$ declare r text; begin
  select string_agg(k || ' ' || (case when got = expected then 'ok' else 'FAIL got=' || got || ' expected=' || expected end), E'\n' order by k) into r from res;
  raise exception E'RESULTS\n%', r;
end $d$;
