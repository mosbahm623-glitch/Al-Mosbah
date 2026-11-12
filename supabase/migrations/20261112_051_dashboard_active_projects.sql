-- لوحة التحكم: إجمالي الوارد والمصروف وصافي النقدية بيحسبوا المشاريع النشطة بس (زي النظام القديم)، والمشاريع المقفولة بره الأرقام دي.
create or replace function public.dashboard_summary()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with
    live as (select id from public.projects where status = 'active'),
    inc as (select coalesce(sum(amount), 0) as v from public.entries where kind = 'income' and status = 'approved' and project_id in (select id from live)),
    exp as (select coalesce(sum(amount), 0) as v from public.entries where kind = 'expense' and advance_id is null and status = 'approved' and project_id in (select id from live)),
    adv as (
      select coalesce((select sum(amount) from public.advance_installments where status = 'approved'), 0)
           - coalesce((select sum(amount) from public.advance_returns), 0) as v
    ),
    due as (
      select coalesce(sum(case kind when 'due' then amount else -amount end), 0) as v
      from public.contractor_transactions
    ),
    spent_adv as (select coalesce(sum(amount), 0) as v from public.entries where kind = 'expense' and advance_id is not null and status = 'approved'),
    spent_live as (select coalesce(sum(amount), 0) as v from public.entries where kind = 'expense' and advance_id is not null and status = 'approved' and project_id in (select id from live)),
    act as (select count(*) as v from public.projects where status = 'active'),
    ps as (
      select p.id, p.name, p.budget,
        coalesce((select sum(e.amount) from public.entries e where e.project_id = p.id and e.kind = 'expense' and e.status = 'approved'), 0) as spent
      from public.projects p
      where p.status = 'active' and p.budget > 0
    )
  select jsonb_build_object(
    'total_income', inc.v,
    'total_expenses', exp.v + spent_live.v,
    'total_advances', adv.v,
    'advances_balance', adv.v - spent_adv.v,
    'contractor_dues', due.v,
    'active_projects', act.v,
    'net_cash', inc.v - (exp.v + spent_live.v) - (adv.v - spent_adv.v) + due.v,
    'over_count', (select count(*) from ps where ps.spent > ps.budget),
    'budget_rows', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', t.id, 'name', t.name, 'budget', t.budget, 'spent', t.spent, 'over', t.spent > t.budget)
        order by t.spent - t.budget desc, t.name
      )
      from (select * from ps order by ps.spent - ps.budget desc, ps.name limit 10) t
    ), '[]'::jsonb)
  )
  from inc, exp, adv, spent_adv, spent_live, due, act
  where private.can_view('dashboard');
$$;
