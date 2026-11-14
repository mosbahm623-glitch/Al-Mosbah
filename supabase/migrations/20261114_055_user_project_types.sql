-- Per-user switch: which project types (finishing / furnishing) a non-admin user may see and spend on.
-- Enforced with RESTRICTIVE policies, so the existing permission policies stay as they are.
alter table public.profiles
  add column project_types text[] not null default array['finishing', 'furnishing']
  check (project_types <@ array['finishing', 'furnishing'] and cardinality(project_types) > 0);

create or replace function private.can_see_project_type(t text)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_admin() or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_active and t = any (p.project_types)
  );
$$;

create or replace function private.can_see_project(pid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select pid is null or exists (
    select 1 from public.projects pr
    where pr.id = pid and private.can_see_project_type(pr.type)
  );
$$;

revoke execute on function private.can_see_project_type(text), private.can_see_project(uuid) from public, anon;
grant execute on function private.can_see_project_type(text), private.can_see_project(uuid) to authenticated;

create policy projects_type_scope on public.projects as restrictive for select to authenticated
  using ((select private.can_see_project_type(type)));

create policy entries_type_scope on public.entries as restrictive for all to authenticated
  using ((select private.can_see_project(project_id)))
  with check ((select private.can_see_project(project_id)));
