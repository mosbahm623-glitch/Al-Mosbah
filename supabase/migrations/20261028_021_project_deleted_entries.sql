-- Deleted entries of one project, for the project page only (greyed out there, never counted in any total or report).
create or replace function public.project_deleted_entries(p_project uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(jsonb_agg(r order by r.deleted_at desc), '[]'::jsonb)
  from (
    select e.id, e.seq, e.kind, e.category, e.item, e.amount, e.entry_date, e.notes, e.rev,
           e.status_before_delete, e.deleted_at,
           p.name as project, c.name as contractor,
           d.full_name as deleted_by_name, u.full_name as created_by_name
    from public.entries e
    left join public.projects p on p.id = e.project_id
    left join public.contractors c on c.id = e.contractor_id
    left join public.profiles d on d.id = e.deleted_by
    left join public.profiles u on u.id = e.created_by
    where e.status = 'deleted' and e.project_id = p_project
  ) r
  where private.can_view('projects');
$function$;
revoke all on function public.project_deleted_entries(uuid) from public, anon;
grant execute on function public.project_deleted_entries(uuid) to authenticated;
