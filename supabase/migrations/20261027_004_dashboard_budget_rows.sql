-- dashboard_summary: replace over_budget list with over_count + budget_rows (top 10 active
-- projects with a budget, most over budget first) for the dashboard budget table.
create or replace function public.dashboard_summary()
returns jsonb
language sql
stable
set search_path = ''
as $$
  with
    inc as (
      select coalesce(sum(amount), 0) as v
      from public.entries where kind = 'income'
    ),
    exp as (
      select coalesce(sum(amount), 0) as v
      from public.entries where kind = 'expense' and advance_id is null
    ),
    adv as (
      select coalesce(sum(amount), 0) as v from public.advance_installments
    ),
    due as (
      select coalesce(sum(case kind when 'due' then amount else -amount end), 0) as v
      from public.contractor_transactions
    ),
    act as (
      select count(*) as v from public.projects where status = 'active'
    ),
    ps as (
      select
        p.id, p.name, p.budget,
        coalesce((
          select sum(e.amount) from public.entries e
          where e.project_id = p.id and e.kind = 'expense' and e.advance_id is null
        ), 0)
        + coalesce((
          select sum(i.amount)
          from public.advance_installments i
          join public.advances a on a.id = i.advance_id
          where a.project_id = p.id
        ), 0) as spent
      from public.projects p
      where p.status = 'active' and p.budget > 0
    )
  select jsonb_build_object(
    'total_income', inc.v,
    'total_expenses', exp.v,
    'total_advances', adv.v,
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
  from inc, exp, adv, due, act;
$$;
