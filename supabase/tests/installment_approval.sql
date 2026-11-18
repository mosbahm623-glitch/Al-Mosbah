-- Integration test for custody payments that wait for approval (migration 035).
-- Run in the Supabase SQL editor or via MCP execute_sql. It creates temporary users and rows,
-- prints one line per check (ok = got matches expected) and ALWAYS rolls back: nothing is kept.
begin;
create temp table res (k text, got text, expected text);
grant all on res to authenticated, anon;
create function pg_temp.chk(k text, got anyelement, expected anyelement) returns void language sql as
$f$ insert into res values (k, got::text, expected::text) $f$;
grant execute on function pg_temp.chk(text, anyelement, anyelement) to authenticated, anon;

-- people: admin (existing), O = owner, H = custody holder (advances editor)
insert into private.allowed_emails(email) values ('o@t.local'), ('h@t.local');
insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','o@t.local'),
  ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','h@t.local');
update public.profiles set is_active = true where email in ('o@t.local','h@t.local');
update public.profiles set role = 'owner' where email = 'o@t.local';
insert into public.user_permissions values ('00000000-0000-0000-0000-0000000000b1','advances','edit');
-- an owner may only use the banks he was given
insert into public.bank_accounts(name) values ('__IB');
insert into public.user_bank_access(user_id, bank_id) select '00000000-0000-0000-0000-0000000000a1', id from public.bank_accounts where name = '__IB';

create temp table ids (admin uuid, adv uuid, adm_inst uuid, own_inst uuid, base_total numeric, base_given numeric);
grant all on ids to authenticated;
insert into ids (admin) select id from public.profiles where role = 'admin' limit 1;

-- ===== admin: a custody and a payment of 500 (approved at once) =====
select set_config('role','authenticated',true);
select set_config('request.jwt.claims', json_build_object('sub',(select admin from ids),'role','authenticated')::text, true);
insert into public.advances(holder_name) values ('__H');
update ids set adv = (select id from public.advances where holder_name = '__H');
insert into public.advance_installments(advance_id, amount, bank_id) select adv, 500, (select id from public.bank_accounts where name = '__IB') from ids;
update ids set adm_inst = (select id from public.advance_installments where amount = 500 and advance_id = (select adv from ids));
select pg_temp.chk('admin_payment_approved', (select status from public.advance_installments where id = (select adm_inst from ids)), 'approved');
update ids set base_total = (public.dashboard_summary()->>'total_advances')::numeric;
select pg_temp.chk('admin_payment_counts', (select (x->>'given')::numeric from jsonb_array_elements(public.advance_summaries()) x where x->>'id' = (select adv::text from ids)), 500::numeric);

-- ===== O: the owner hands out 300 =====
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
insert into public.advance_installments(advance_id, amount, bank_id) select adv, 300, (select id from public.bank_accounts where name = '__IB') from ids;
update ids set own_inst = (select id from public.advance_installments where amount = 300 and advance_id = (select adv from ids));
select pg_temp.chk('O_payment_pending', (select status from public.advance_installments where id = (select own_inst from ids)), 'pending');
select pg_temp.chk('O_created_by_set', (select created_by::text from public.advance_installments where id = (select own_inst from ids)), '00000000-0000-0000-0000-0000000000a1');
select pg_temp.chk('O_pending_not_in_given', (select (x->>'given')::numeric from jsonb_array_elements(public.advance_summaries()) x where x->>'id' = (select adv::text from ids)), 500::numeric);
select pg_temp.chk('O_pending_not_in_dashboard', (public.dashboard_summary()->>'total_advances')::numeric, (select base_total from ids));
update public.advance_installments set amount = 350 where id = (select own_inst from ids);
select pg_temp.chk('O_edits_own_pending', (select amount from public.advance_installments where id = (select own_inst from ids)), 350::numeric);
select pg_temp.chk('O_edit_stays_pending', (select status from public.advance_installments where id = (select own_inst from ids)), 'pending');
update public.advance_installments set status = 'approved' where id = (select own_inst from ids);
select pg_temp.chk('O_cannot_self_approve', (select status from public.advance_installments where id = (select own_inst from ids)), 'pending');
update public.advance_installments set amount = 1 where id = (select adm_inst from ids);
select pg_temp.chk('O_cannot_edit_approved', (select amount from public.advance_installments where id = (select adm_inst from ids)), 500::numeric);
with d as (delete from public.advance_installments where id = (select adm_inst from ids) returning 1)
  select pg_temp.chk('O_cannot_delete_approved', (select count(*) from d), 0::bigint);
select pg_temp.chk('O_sees_both_payments', (select count(*) from public.advance_installments where advance_id = (select adv from ids)), 2::bigint);

-- ===== admin hears about it, then approves =====
select set_config('request.jwt.claims', json_build_object('sub',(select admin from ids),'role','authenticated')::text, true);
update public.advance_installments set status = 'approved' where id = (select own_inst from ids);
select pg_temp.chk('approved_counts_in_given', (select (x->>'given')::numeric from jsonb_array_elements(public.advance_summaries()) x where x->>'id' = (select adv::text from ids)), 850::numeric);
select pg_temp.chk('approved_counts_in_dashboard', (public.dashboard_summary()->>'total_advances')::numeric, (select base_total from ids) + 350);
select pg_temp.chk('decided_by_set', (select decided_by = (select admin from ids) from public.advance_installments where id = (select own_inst from ids)), true);

-- ===== rejection needs a reason; the owner can fix a rejected payment and send it again =====
insert into public.advance_installments(advance_id, amount, bank_id) select adv, 40, (select id from public.bank_accounts where name = '__IB') from ids;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
insert into public.advance_installments(advance_id, amount, bank_id) select adv, 60, (select id from public.bank_accounts where name = '__IB') from ids;
select set_config('request.jwt.claims', json_build_object('sub',(select admin from ids),'role','authenticated')::text, true);
do $$ begin
  begin update public.advance_installments set status = 'rejected' where amount = 60; perform pg_temp.chk('reject_without_reason','ALLOWED'::text,'blocked'::text);
  exception when others then perform pg_temp.chk('reject_without_reason','blocked'::text,'blocked'::text); end;
end $$;
update public.advance_installments set status = 'rejected', reject_reason = 'مبلغ غلط' where amount = 60;
select pg_temp.chk('rejected_has_reason', (select reject_reason from public.advance_installments where amount = 60), 'مبلغ غلط');
select pg_temp.chk('rejected_not_counted', (select (x->>'given')::numeric from jsonb_array_elements(public.advance_summaries()) x where x->>'id' = (select adv::text from ids)), 890::numeric); -- 850 + the admin's own 40, without the rejected 60
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
update public.advance_installments set amount = 55 where amount = 60;
select pg_temp.chk('O_fix_resends', (select status from public.advance_installments where amount = 55), 'pending');
select pg_temp.chk('O_fix_clears_reason', (select reject_reason is null from public.advance_installments where amount = 55), true);
with d as (delete from public.advance_installments where amount = 55 returning 1)
  select pg_temp.chk('O_deletes_own_pending', (select count(*) from d), 1::bigint);

-- ===== H: a custody holder still cannot add payments =====
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
do $$ begin
  begin insert into public.advance_installments(advance_id, amount, bank_id) select adv, 1, (select id from public.bank_accounts where name = '__IB') from ids; perform pg_temp.chk('H_add_installment','ALLOWED'::text,'blocked'::text);
  exception when others then perform pg_temp.chk('H_add_installment','blocked'::text,'blocked'::text); end;
end $$;
select set_config('role','postgres',true);

select k, got, expected, (got = expected or (got ~ '^-?[0-9.]+$' and expected ~ '^-?[0-9.]+$' and got::numeric = expected::numeric)) as ok
from res order by 4, k;
rollback;
