-- Integration test for transfers between custodies (migration 069). Prints one line per check; ALWAYS rolls back.
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

create temp table ids (admin uuid, a uuid, b uuid, t uuid, base_total numeric);
grant all on ids to authenticated;
insert into ids (admin) select id from public.profiles where role = 'admin' limit 1;

select set_config('role','authenticated',true);
select set_config('request.jwt.claims', json_build_object('sub',(select admin from ids),'role','authenticated')::text, true);
insert into public.advances(holder_name) values ('__TA'), ('__TB');
update ids set a = (select id from public.advances where holder_name = '__TA'), b = (select id from public.advances where holder_name = '__TB');
update ids set base_total = (public.dashboard_summary()->>'total_advances')::numeric;

-- ===== admin transfers 700 from A to B =====
update ids set t = public.transfer_between_advances((select a from ids), (select b from ids), 700, current_date, 'x');
select pg_temp.chk('A_returned_700', (select (x->>'returned')::numeric from jsonb_array_elements(public.advance_summaries()) x where x->>'id' = (select a::text from ids)), 700::numeric);
select pg_temp.chk('B_given_700', (select (x->>'given')::numeric from jsonb_array_elements(public.advance_summaries()) x where x->>'id' = (select b::text from ids)), 700::numeric);
select pg_temp.chk('payment_approved_no_bank', (select status || coalesce(bank_id::text,'-') from public.advance_installments where transfer_id = (select t from ids)), 'approved-');
select pg_temp.chk('return_note_names_target', (select notes from public.advance_returns where transfer_id = (select t from ids)), 'تحويل إلى عهدة __TB · x');
select pg_temp.chk('dashboard_total_unchanged', (public.dashboard_summary()->>'total_advances')::numeric, (select base_total from ids));

-- ===== bad input =====
do $$ begin
  begin perform public.transfer_between_advances((select a from ids), (select a from ids), 1, current_date, null); perform pg_temp.chk('same_custody','ALLOWED'::text,'blocked'::text);
  exception when others then perform pg_temp.chk('same_custody','blocked'::text,'blocked'::text); end;
  begin perform public.transfer_between_advances((select a from ids), (select b from ids), 0, current_date, null); perform pg_temp.chk('zero_amount','ALLOWED'::text,'blocked'::text);
  exception when others then perform pg_temp.chk('zero_amount','blocked'::text,'blocked'::text); end;
end $$;

-- ===== cancelling removes both sides =====
select public.cancel_advance_transfer((select t from ids));
select pg_temp.chk('cancel_removes_both', (select (select count(*) from public.advance_returns where transfer_id = (select t from ids)) + (select count(*) from public.advance_installments where transfer_id = (select t from ids))), 0::bigint);

-- ===== an owner cannot transfer, cancel, or make a bank-less payment by pointing at a transfer =====
update ids set t = public.transfer_between_advances((select a from ids), (select b from ids), 5, current_date, null);
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
do $$ begin
  begin perform public.transfer_between_advances((select a from ids), (select b from ids), 1, current_date, null); perform pg_temp.chk('O_transfer','ALLOWED'::text,'blocked'::text);
  exception when others then perform pg_temp.chk('O_transfer','blocked'::text,'blocked'::text); end;
  begin perform public.cancel_advance_transfer((select t from ids)); perform pg_temp.chk('O_cancel','ALLOWED'::text,'blocked'::text);
  exception when others then perform pg_temp.chk('O_cancel','blocked'::text,'blocked'::text); end;
  begin insert into public.advance_installments(advance_id, amount, transfer_id) select b, 1, t from ids; perform pg_temp.chk('O_bankless_payment','ALLOWED'::text,'blocked'::text);
  exception when others then perform pg_temp.chk('O_bankless_payment','blocked'::text,'blocked'::text); end;
end $$;
select set_config('role','postgres',true);

select k, got, expected, (got = expected or (got ~ '^-?[0-9.]+$' and expected ~ '^-?[0-9.]+$' and got::numeric = expected::numeric)) as ok
from res order by 4, k;
rollback;
