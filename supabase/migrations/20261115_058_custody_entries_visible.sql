-- المستخدم يشوف كل قيود عهدته ومشاريعها حتى لو من نوع مش مسموح له (للقراءة بس).
-- التسجيل والتعديل والحذف يفضلوا مقيّدين بنوع المشروع، وبالمشاريع اللي الأدمن حددها.
create function private.project_has_my_custody_entry(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.entries e
    where e.project_id = pid and e.advance_id is not null and private.can_see_advance(e.advance_id)
  );
$$;
revoke execute on function private.project_has_my_custody_entry(uuid) from public, anon;
grant execute on function private.project_has_my_custody_entry(uuid) to authenticated;

drop policy projects_type_scope on public.projects;
create policy projects_type_scope on public.projects as restrictive for select to authenticated
  using ((select private.can_see_project_type(type)) or (select private.project_has_my_custody_entry(id)));

drop policy entries_type_scope on public.entries;
create policy entries_type_scope_select on public.entries as restrictive for select to authenticated
  using ((select private.can_see_project(project_id)) or (advance_id is not null and (select private.can_see_advance(advance_id))));
create policy entries_type_scope_insert on public.entries as restrictive for insert to authenticated
  with check ((select private.can_see_project(project_id)));
create policy entries_type_scope_update on public.entries as restrictive for update to authenticated
  using ((select private.can_see_project(project_id)) or (advance_id is not null and (select private.can_see_advance(advance_id))))
  with check ((select private.can_see_project(project_id)));
create policy entries_type_scope_delete on public.entries as restrictive for delete to authenticated
  using ((select private.can_see_project(project_id)));
