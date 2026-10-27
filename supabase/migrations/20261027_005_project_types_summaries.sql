-- نوع المشروع: تشطيب / فرش
alter table public.projects
  add column type text not null default 'finishing'
  check (type in ('finishing', 'furnishing'));

-- project_summaries: one row per project with income / expenses computed in the database.
-- Expenses = expense entries not paid from a custody + the custody installments of that project.
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
                  where a.project_id = p.id), 0) as expenses
    from public.projects p
  ) r;
$$;
