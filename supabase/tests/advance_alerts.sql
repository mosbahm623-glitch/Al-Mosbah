-- Integration test for the custody balance alert and the rejection notice (migration 075). ALWAYS rolls back.
begin;
create temp table res (k text, got text, expected text);
grant all on res to authenticated;
create function pg_temp.chk(k text, got anyelement, expected anyelement) returns void language sql as
$f$ insert into res values (k, got::text, expected::text) $f$;
grant execute on function pg_temp.chk(text, anyelement, anyelement) to authenticated;
create function pg_temp.act(u uuid) returns void language sql as
$f$ select set_config('request.jwt.claims', case when u is null then '{}' else json_build_object('sub',u,'role','authenticated')::text end, true) $f$;
create function pg_temp.n(u uuid, k text) returns bigint language sql as
$f$ select count(*) from public.notifications where user_id = u and kind = k $f$;

\set admin '''00000000-0000-4000-8000-0000000000a1'''
\set holder '''00000000-0000-4000-8000-0000000000b1'''

insert into public.advances(id, holder_name) values ('00000000-0000-4000-8000-00000000ad01', '__AL');
insert into public.user_advance_access(user_id, advance_id) values (:holder, '00000000-0000-4000-8000-00000000ad01');
insert into public.projects(id, name) values ('00000000-0000-4000-8000-00000000bd01', '__ALP');
create function pg_temp.spend(a numeric) returns void language sql as
$f$ insert into public.entries(project_id, kind, category, item, amount, advance_id)
    values ('00000000-0000-4000-8000-00000000bd01','expense','مواد','x',a,'00000000-0000-4000-8000-00000000ad01') $f$;
insert into public.advance_installments(advance_id, amount) values ('00000000-0000-4000-8000-00000000ad01', 10000);

-- nothing is enabled yet: no alert even when negative balances happen elsewhere
select pg_temp.spend(6000);
select pg_temp.chk('disabled_no_alert', pg_temp.n(:admin, 'advance_low'), 0::bigint);

-- admin enables it at 5,000 (balance is 4,000 now): saving itself sends nothing
select pg_temp.act(:admin);
select public.save_advance_alert_settings(true, true, false,
  '[{"id":"00000000-0000-4000-8000-00000000ad01","enabled":true,"threshold":5000}]');
select pg_temp.chk('save_sends_nothing', pg_temp.n(:admin, 'advance_low'), 0::bigint);
select pg_temp.chk('settings_read_back', (select (x->>'balance')::numeric from jsonb_array_elements(public.advance_alert_settings()->'advances') x where x->>'holder_name' = '__AL')::bigint, 4000::bigint);
select pg_temp.act(null);

-- top up above the limit, then cross it: admin and holder hear once
insert into public.advance_installments(advance_id, amount) values ('00000000-0000-4000-8000-00000000ad01', 5000);
select pg_temp.spend(5000);
select pg_temp.chk('crossing_admin', pg_temp.n(:admin, 'advance_low'), 1::bigint);
select pg_temp.chk('crossing_holder', pg_temp.n(:holder, 'advance_low'), 1::bigint);
select pg_temp.spend(100);
select pg_temp.chk('no_repeat', pg_temp.n(:admin, 'advance_low'), 1::bigint);
select pg_temp.spend(5000);
select pg_temp.chk('negative_alerts_again', (select count(*) from public.notifications where user_id = :admin and kind='advance_low' and title = 'رصيد العهدة بالسالب'), 1::bigint);
-- recovery then drop re-arms; a return also counts
insert into public.advance_installments(advance_id, amount) values ('00000000-0000-4000-8000-00000000ad01', 20000);
insert into public.advance_returns(advance_id, amount) values ('00000000-0000-4000-8000-00000000ad01', 16000);
select pg_temp.chk('return_triggers', pg_temp.n(:admin, 'advance_low'), 3::bigint);

-- holder unticked
select pg_temp.act(:admin);
select public.save_advance_alert_settings(true, false, false,
  '[{"id":"00000000-0000-4000-8000-00000000ad01","enabled":true,"threshold":5000}]');
select pg_temp.act(null);
select pg_temp.spend(9000);
select pg_temp.chk('holder_off', pg_temp.n(:holder, 'advance_low'), 3::bigint);
select pg_temp.chk('admin_still', pg_temp.n(:admin, 'advance_low'), 4::bigint);

-- ordinary user cannot read or change the settings
set local role authenticated;
select pg_temp.act(:holder);
do $$ begin
  begin perform public.advance_alert_settings(); perform pg_temp.chk('user_read','ALLOWED'::text,'blocked'::text);
  exception when insufficient_privilege then perform pg_temp.chk('user_read','blocked'::text,'blocked'::text); end;
  begin perform public.save_advance_alert_settings(true,true,true,'[]'); perform pg_temp.chk('user_save','ALLOWED'::text,'blocked'::text);
  exception when insufficient_privilege then perform pg_temp.chk('user_save','blocked'::text,'blocked'::text); end;
end $$;
reset role;
-- the holder records an entry, the admin rejects it: the holder hears once, with the reason
select pg_temp.spend(250);
select pg_temp.act(:admin);
update public.entries set status = 'rejected', reject_reason = 'الفاتورة مش واضحة'
  where advance_id = '00000000-0000-4000-8000-00000000ad01' and amount = 250;
select pg_temp.chk('reject_notifies', (select count(*) from public.notifications where user_id = :holder and kind = 'rejected'
  and title = 'قيدك اترفض' and body like '%250 ج.م%' and body like '%السبب: الفاتورة مش واضحة'
  and url = '#/advances/00000000-0000-4000-8000-00000000ad01'), 1::bigint);
select pg_temp.chk('actor_gets_no_reject', pg_temp.n(:admin, 'rejected'), 0::bigint);
-- approving sends no rejection
select pg_temp.act(:holder);
select pg_temp.spend(300);
select pg_temp.act(:admin);
update public.entries set status = 'approved' where advance_id = '00000000-0000-4000-8000-00000000ad01' and amount = 300;
select pg_temp.chk('approve_no_reject', pg_temp.n(:holder, 'rejected'), 1::bigint);
-- a rejected custody payment notifies whoever recorded it
insert into public.bank_accounts(name) values ('__ALB');
select pg_temp.act(:holder);
insert into public.advance_installments(advance_id, amount, bank_id)
  select '00000000-0000-4000-8000-00000000ad01', 777, id from public.bank_accounts where name = '__ALB';
select pg_temp.act(:admin);
update public.advance_installments set status = 'rejected', reject_reason = 'مكررة' where amount = 777;
select pg_temp.chk('installment_reject', (select count(*) from public.notifications where user_id = :holder and kind = 'rejected' and title = 'دفعة العهدة اترفضت'), 1::bigint);

select k, got, expected, case when got = expected then 'ok' else 'FAIL' end as result from res;
rollback;
