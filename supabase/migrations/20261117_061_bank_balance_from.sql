-- A bank can start fresh from a date: its balance (and its statement) counts only entries and custody
-- payments from that date on; older ones stay in the books under the same bank name.
alter table public.bank_accounts add column if not exists balance_from date;

create or replace function public.bank_summaries()
 returns jsonb
 language sql
 stable security definer
 set search_path to ''
as $function$
  select coalesce(jsonb_agg(r order by r.name), '[]'::jsonb)
  from (
    select
      b.id, b.name, b.logo, b.opening_balance,
      coalesce((select sum(e.amount) from public.entries e where e.bank_id = b.id and e.kind = 'income' and e.status = 'approved'
                and (b.balance_from is null or e.entry_date >= b.balance_from)), 0) as income,
      coalesce((select sum(e.amount) from public.entries e where e.bank_id = b.id and e.kind = 'expense' and e.status = 'approved'
                and (b.balance_from is null or e.entry_date >= b.balance_from)), 0)
        + coalesce((select sum(i.amount) from public.advance_installments i where i.bank_id = b.id and i.status = 'approved'
                and (b.balance_from is null or i.paid_on >= b.balance_from)), 0) as expenses
    from public.bank_accounts b
  ) r
  where private.can_view('banks');
$function$;

create or replace function public.bank_movements(p_bank uuid)
 returns jsonb
 language sql
 stable security definer
 set search_path to ''
as $function$
  select coalesce(jsonb_agg(r order by r.entry_date, r.seq), '[]'::jsonb)
  from (
    select
      e.id, e.seq, e.kind, e.entry_date, e.category, e.item, e.notes, e.amount,
      p.id as project_id, p.name as project_name, c.name as contractor
    from public.entries e
    join public.projects p on p.id = e.project_id
    left join public.contractors c on c.id = e.contractor_id
    where e.bank_id = p_bank and e.status = 'approved'
      and e.entry_date >= coalesce((select b.balance_from from public.bank_accounts b where b.id = p_bank), date '0001-01-01')
    union all
    select
      i.id, null::bigint, 'expense', i.paid_on, 'دفعة عهدة', a.holder_name, null::text, i.amount,
      null::uuid, 'عهد', null::text
    from public.advance_installments i
    join public.advances a on a.id = i.advance_id
    where i.bank_id = p_bank and i.status = 'approved'
      and i.paid_on >= coalesce((select b.balance_from from public.bank_accounts b where b.id = p_bank), date '0001-01-01')
  ) r
  where private.can_view('banks');
$function$;

-- Fresh start on 17-11-2026: opening balance = the real balance, older movements no longer count.
update public.bank_accounts set balance_from = date '2026-11-17',
  opening_balance = case name
    when 'Al Ahly' then 107207.18
    when 'CIB' then 1111.05
    when 'CIB شركات' then 45920.91
    else 0 end;
