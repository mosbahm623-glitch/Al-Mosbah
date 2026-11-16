-- Entries that look the same: same day, kind, البند, البيان, project and amount (deleted ones left out).
-- Admin only. A group is a hint to review, not proof of a mistake (a tip paid twice in a day is a real repeat).
create or replace function public.duplicate_entry_groups()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(g order by g.kind desc, g.amount desc, g.entry_date), '[]'::jsonb)
  from (
    select
      e.entry_date, e.kind, e.amount, e.category, e.item, p.name as project,
      count(*) as n,
      jsonb_agg(jsonb_build_object('seq', e.seq, 'status', e.status) order by e.seq) as entries
    from public.entries e
    left join public.projects p on p.id = e.project_id
    where e.deleted_at is null
    group by e.entry_date, e.kind, e.amount, e.category, e.item, e.project_id, p.name
    having count(*) > 1
  ) g
  where private.is_admin();
$$;
