-- Banks page: opening balance per bank, and a "banks" permission module.
alter table public.user_permissions drop constraint user_permissions_module_check;
alter table public.user_permissions add constraint user_permissions_module_check
  check (module in ('dashboard', 'projects', 'advances', 'banks', 'contractors', 'reports', 'tools'));

alter table public.bank_accounts add column opening_balance numeric(14, 2) not null default 0;

-- bank names + opening balances: readable by bank viewers and by people who enter data (they pick the bank)
drop policy bank_accounts_select on public.bank_accounts;
drop policy bank_accounts_update on public.bank_accounts;
drop policy bank_accounts_delete on public.bank_accounts;
drop policy bank_accounts_insert on public.bank_accounts;
create policy bank_accounts_select on public.bank_accounts for select to authenticated
  using ((select private.can_view('banks')) or (select private.can_edit('projects')) or (select private.can_edit('advances')) or (select private.can_edit('contractors')));
create policy bank_accounts_insert on public.bank_accounts for insert to authenticated
  with check ((select private.can_edit('banks')) or (select private.can_edit('projects')) or (select private.can_edit('advances')) or (select private.can_edit('contractors')));
create policy bank_accounts_update on public.bank_accounts for update to authenticated
  using ((select private.can_edit('banks'))) with check ((select private.can_edit('banks')));
create policy bank_accounts_delete on public.bank_accounts for delete to authenticated
  using ((select private.can_edit('banks')));

-- One row per bank: opening balance, money in (وارد), money out (مصروف) and the current balance.
create function public.bank_summaries()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(r order by r.name), '[]'::jsonb)
  from (
    select
      b.id, b.name, b.opening_balance,
      coalesce((select sum(e.amount) from public.entries e where e.bank_id = b.id and e.kind = 'income'), 0) as income,
      coalesce((select sum(e.amount) from public.entries e where e.bank_id = b.id and e.kind = 'expense'), 0) as expenses
    from public.bank_accounts b
  ) r
  where private.can_view('banks');
$$;

-- Every movement of one bank (all projects), oldest first.
create function public.bank_movements(p_bank uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(r order by r.entry_date, r.seq), '[]'::jsonb)
  from (
    select
      e.id, e.seq, e.kind, e.entry_date, e.category, e.item, e.notes, e.amount,
      p.id as project_id, p.name as project_name, c.name as contractor
    from public.entries e
    join public.projects p on p.id = e.project_id
    left join public.contractors c on c.id = e.contractor_id
    where e.bank_id = p_bank
  ) r
  where private.can_view('banks');
$$;

revoke execute on function public.bank_summaries(), public.bank_movements(uuid) from public, anon;
grant execute on function public.bank_summaries(), public.bank_movements(uuid) to authenticated;
