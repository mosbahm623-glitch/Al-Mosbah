-- المشاريع اللي المستخدم العادي يقدر يسجّل عليها قيود (ومنها مصروف العهدة): الأدمن بيحدّدها لكل مستخدم.
-- مستخدم من غير مشاريع محددة = كل المشاريع (زي ما هو دلوقتي). الأدمن والمالك مش بيتقيّدوا.
-- الشرط على التسجيل والتعديل بس؛ القيود القديمة تفضل ظاهرة والأرصدة ما بتتأثرش.
create table public.user_project_access (
  user_id uuid not null references public.profiles (id) on delete cascade,
  project_id uuid not null,
  primary key (user_id, project_id)
);
create index user_project_access_project_id_idx on public.user_project_access (project_id);
alter table public.user_project_access enable row level security;

-- the user sees his own list (the forms need it); only the admin sets it, so nobody can widen his own list
create policy user_project_access_select on public.user_project_access for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy user_project_access_insert on public.user_project_access for insert to authenticated
  with check ((select private.is_admin()));
create policy user_project_access_delete on public.user_project_access for delete to authenticated
  using ((select private.is_admin()));

create function private.entry_project_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null or new.project_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.project_id is not distinct from old.project_id then
    return new;
  end if;
  if not exists (select 1 from public.profiles where id = uid and role = 'user') then
    return new;
  end if;
  -- no list (or a list of projects that no longer exist) = every project
  if exists (
    select 1 from public.user_project_access a join public.projects p on p.id = a.project_id where a.user_id = uid
  ) and not exists (
    select 1 from public.user_project_access where user_id = uid and project_id = new.project_id
  ) then
    raise exception 'project not allowed' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function private.entry_project_access() from public, anon, authenticated;
create trigger entry_project_access before insert or update on public.entries
  for each row execute function private.entry_project_access();
