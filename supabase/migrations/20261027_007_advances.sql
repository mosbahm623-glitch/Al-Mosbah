-- العهد: status, notes, returns (رد عهدة) and per-advance summaries.
alter table public.advances
  add column status text not null default 'open' check (status in ('open', 'closed')),
  add column notes text;

create table public.advance_returns (
  id uuid primary key default gen_random_uuid(),
  advance_id uuid not null references public.advances (id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  returned_on date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);
create index advance_returns_advance_id_idx on public.advance_returns (advance_id);

alter table public.advance_returns enable row level security;
create policy advance_returns_select on public.advance_returns for select to authenticated using ((select private.is_active_user()));
create policy advance_returns_insert_admin on public.advance_returns for insert to authenticated with check ((select private.is_admin()));
create policy advance_returns_update_admin on public.advance_returns for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy advance_returns_delete_admin on public.advance_returns for delete to authenticated using ((select private.is_admin()));

-- One row per advance. balance = given − spent − returned.
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
      a.project_id, p.name as project_name,
      coalesce((select sum(i.amount) from public.advance_installments i where i.advance_id = a.id), 0) as given,
      coalesce((select sum(e.amount) from public.entries e where e.advance_id = a.id and e.kind = 'expense'), 0) as spent,
      coalesce((select sum(x.amount) from public.advance_returns x where x.advance_id = a.id), 0) as returned
    from public.advances a
    join public.projects p on p.id = a.project_id
  ) r;
$$;

-- A project's cost of custodies = installments handed out − money returned (entries paid from a
-- custody are not counted again).
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
      coalesce((select sum(e.amount) from public.entries e
                where e.project_id = p.id and e.kind = 'income'), 0) as income,
      coalesce((select sum(e.amount) from public.entries e
                where e.project_id = p.id and e.kind = 'expense' and e.advance_id is null), 0)
      + coalesce((select sum(i.amount)
                  from public.advance_installments i
                  join public.advances a on a.id = i.advance_id
                  where a.project_id = p.id), 0)
      - coalesce((select sum(x.amount)
                  from public.advance_returns x
                  join public.advances a on a.id = x.advance_id
                  where a.project_id = p.id), 0) as expenses,
      coalesce((select sum(e.amount) from public.entries e
                where e.project_id = p.id and e.kind = 'expense' and e.advance_id is null), 0) as direct_expenses
    from public.projects p
  ) r;
$$;

create or replace function public.dashboard_summary()
returns jsonb
language sql
stable
set search_path = ''
as $$
  with
    inc as (select coalesce(sum(amount), 0) as v from public.entries where kind = 'income'),
    exp as (select coalesce(sum(amount), 0) as v from public.entries where kind = 'expense' and advance_id is null),
    adv as (
      select coalesce((select sum(amount) from public.advance_installments), 0)
           - coalesce((select sum(amount) from public.advance_returns), 0) as v
    ),
    due as (
      select coalesce(sum(case kind when 'due' then amount else -amount end), 0) as v
      from public.contractor_transactions
    ),
    act as (select count(*) as v from public.projects where status = 'active'),
    ps as (
      select p.id, p.name, p.budget,
        coalesce((select sum(e.amount) from public.entries e
                  where e.project_id = p.id and e.kind = 'expense' and e.advance_id is null), 0)
        + coalesce((select sum(i.amount) from public.advance_installments i
                    join public.advances a on a.id = i.advance_id where a.project_id = p.id), 0)
        - coalesce((select sum(x.amount) from public.advance_returns x
                    join public.advances a on a.id = x.advance_id where a.project_id = p.id), 0) as spent
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
