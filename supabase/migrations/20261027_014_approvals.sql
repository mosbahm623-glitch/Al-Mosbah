-- Approvals: entries made by anyone who is not an admin start as 'pending' and only count in totals
-- once an admin approves them. Admin-made entries are approved immediately.
alter table public.entries
  add column status text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
  add column decided_by uuid references public.profiles (id),
  add column decided_at timestamptz;
-- entries.created_by already exists (auth.users); this second key lets the API embed the creator's profile
alter table public.entries add constraint entries_created_by_profile_fkey foreign key (created_by) references public.profiles (id);
create index entries_status_idx on public.entries (status) where status <> 'approved';

create function private.entry_approval_flow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
    new.decided_by := null;
    new.decided_at := null;
    new.status := case when private.is_admin() or (select auth.uid()) is null then 'approved' else 'pending' end;
  else
    new.created_by := old.created_by;
    if private.is_admin() or (select auth.uid()) is null then
      if new.status is distinct from old.status then
        new.decided_by := (select auth.uid());
        new.decided_at := now();
      else
        new.decided_by := old.decided_by;
        new.decided_at := old.decided_at;
      end if;
    else
      -- a non-admin edit sends the entry back for approval
      new.status := 'pending';
      new.decided_by := null;
      new.decided_at := null;
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function private.entry_approval_flow() from public, anon, authenticated;
create trigger entry_approval_flow before insert or update on public.entries
  for each row execute function private.entry_approval_flow();

-- non-admins may change only their own entries that are not approved yet
drop policy entries_update on public.entries;
drop policy entries_delete on public.entries;
create policy entries_update on public.entries for update to authenticated
  using (
    (select private.is_admin())
    or (created_by = (select auth.uid()) and status <> 'approved'
        and ((select private.can_edit('projects')) or (advance_id is not null and (select private.can_edit('advances')))))
  )
  with check (
    (select private.is_admin())
    or (created_by = (select auth.uid())
        and ((select private.can_edit('projects')) or (advance_id is not null and (select private.can_edit('advances')))))
  );
create policy entries_delete on public.entries for delete to authenticated
  using (
    (select private.is_admin())
    or (created_by = (select auth.uid()) and status <> 'approved'
        and ((select private.can_edit('projects')) or (advance_id is not null and (select private.can_edit('advances')))))
  );

-- ===== totals count approved entries only =====
create or replace function public.advance_summaries()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(r order by r.created_at desc), '[]'::jsonb)
  from (
    select
      a.id, a.holder_name, a.status, a.notes, a.created_at,
      coalesce((select sum(i.amount) from public.advance_installments i where i.advance_id = a.id), 0) as given,
      coalesce((select sum(e.amount) from public.entries e where e.advance_id = a.id and e.kind = 'expense' and e.status = 'approved'), 0) as spent,
      coalesce((select sum(x.amount) from public.advance_returns x where x.advance_id = a.id), 0) as returned
    from public.advances a
  ) r;
$$;

create or replace function public.project_summaries()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(r order by r.created_at desc), '[]'::jsonb)
  from (
    select
      p.id, p.name, p.budget, p.status, p.type, p.created_at,
      coalesce((select sum(e.amount) from public.entries e where e.project_id = p.id and e.kind = 'income' and e.status = 'approved'), 0) as income,
      coalesce((select sum(e.amount) from public.entries e where e.project_id = p.id and e.kind = 'expense' and e.status = 'approved'), 0) as expenses
    from public.projects p
  ) r;
$$;

create or replace function public.bank_summaries()
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
      coalesce((select sum(e.amount) from public.entries e where e.bank_id = b.id and e.kind = 'income' and e.status = 'approved'), 0) as income,
      coalesce((select sum(e.amount) from public.entries e where e.bank_id = b.id and e.kind = 'expense' and e.status = 'approved'), 0) as expenses
    from public.bank_accounts b
  ) r
  where private.can_view('banks');
$$;

create or replace function public.bank_movements(p_bank uuid)
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
    where e.bank_id = p_bank and e.status = 'approved'
  ) r
  where private.can_view('banks');
$$;

create or replace function public.dashboard_summary()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with
    inc as (select coalesce(sum(amount), 0) as v from public.entries where kind = 'income' and status = 'approved'),
    exp as (select coalesce(sum(amount), 0) as v from public.entries where kind = 'expense' and advance_id is null and status = 'approved'),
    adv as (
      select coalesce((select sum(amount) from public.advance_installments), 0)
           - coalesce((select sum(amount) from public.advance_returns), 0) as v
    ),
    due as (
      select coalesce(sum(case kind when 'due' then amount else -amount end), 0) as v
      from public.contractor_transactions
    ),
    spent_adv as (select coalesce(sum(amount), 0) as v from public.entries where kind = 'expense' and advance_id is not null and status = 'approved'),
    act as (select count(*) as v from public.projects where status = 'active'),
    ps as (
      select p.id, p.name, p.budget,
        coalesce((select sum(e.amount) from public.entries e where e.project_id = p.id and e.kind = 'expense' and e.status = 'approved'), 0) as spent
      from public.projects p
      where p.status = 'active' and p.budget > 0
    )
  select jsonb_build_object(
    'total_income', inc.v,
    'total_expenses', exp.v + spent_adv.v,
    'total_advances', adv.v,
    'advances_balance', adv.v - spent_adv.v,
    'contractor_dues', due.v,
    'active_projects', act.v,
    'net_cash', inc.v - exp.v - adv.v + due.v,
    'over_count', (select count(*) from ps where ps.spent > ps.budget),
    'budget_rows', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', t.id, 'name', t.name, 'budget', t.budget, 'spent', t.spent, 'over', t.spent > t.budget)
        order by t.spent - t.budget desc, t.name
      )
      from (select * from ps order by ps.spent - ps.budget desc, ps.name limit 10) t
    ), '[]'::jsonb)
  )
  from inc, exp, adv, spent_adv, due, act
  where private.can_view('dashboard');
$$;
