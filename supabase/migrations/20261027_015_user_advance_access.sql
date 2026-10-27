-- Which custodies a user may see: the admin ticks them per user (user dialog). A user with the
-- "advances" permission sees only those custodies; admins see all. Only admins create or change
-- custodies and record installments / returns; a user with "edit" records expenses from his custodies.
create table public.user_advance_access (
  user_id uuid not null references public.profiles (id) on delete cascade,
  advance_id uuid not null references public.advances (id) on delete cascade,
  primary key (user_id, advance_id)
);
alter table public.user_advance_access enable row level security;
create policy user_advance_access_select on public.user_advance_access for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy user_advance_access_insert on public.user_advance_access for insert to authenticated with check ((select private.is_admin()));
create policy user_advance_access_delete on public.user_advance_access for delete to authenticated using ((select private.is_admin()));

create function private.can_see_advance(adv uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin() or exists (
    select 1 from public.user_advance_access ua where ua.advance_id = adv and ua.user_id = (select auth.uid())
  );
$$;
revoke execute on function private.can_see_advance(uuid) from public, anon;
grant execute on function private.can_see_advance(uuid) to authenticated;

do $$
declare
  p record;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in ('advances', 'advance_installments', 'advance_returns')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end;
$$;

create policy advances_select on public.advances for select to authenticated
  using ((select private.is_admin()) or ((select private.can_view('advances')) and (select private.can_see_advance(id))));
create policy advances_insert on public.advances for insert to authenticated with check ((select private.is_admin()));
create policy advances_update on public.advances for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy advances_delete on public.advances for delete to authenticated using ((select private.is_admin()));

do $$
declare
  t text;
begin
  foreach t in array array['advance_installments', 'advance_returns']
  loop
    execute format('create policy %I on public.%I for select to authenticated using ((select private.is_admin()) or ((select private.can_view(''advances'')) and (select private.can_see_advance(advance_id))))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select private.is_admin()))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select private.is_admin()))', t || '_delete', t);
  end loop;
end;
$$;

-- entries paid from a custody follow the custody's owner
drop policy entries_select on public.entries;
drop policy entries_insert on public.entries;
drop policy entries_update on public.entries;
drop policy entries_delete on public.entries;
create policy entries_select on public.entries for select to authenticated
  using (
    (select private.can_view('projects'))
    or (advance_id is not null and (select private.can_view('advances')) and (select private.can_see_advance(advance_id)))
  );
create policy entries_insert on public.entries for insert to authenticated
  with check (
    (select private.can_edit('projects'))
    or (advance_id is not null and (select private.can_edit('advances')) and (select private.can_see_advance(advance_id)))
  );
create policy entries_update on public.entries for update to authenticated
  using (
    (select private.is_admin())
    or (created_by = (select auth.uid()) and status <> 'approved'
        and ((select private.can_edit('projects'))
             or (advance_id is not null and (select private.can_edit('advances')) and (select private.can_see_advance(advance_id)))))
  )
  with check (
    (select private.is_admin())
    or (created_by = (select auth.uid())
        and ((select private.can_edit('projects'))
             or (advance_id is not null and (select private.can_edit('advances')) and (select private.can_see_advance(advance_id)))))
  );
create policy entries_delete on public.entries for delete to authenticated
  using (
    (select private.is_admin())
    or (created_by = (select auth.uid()) and status <> 'approved'
        and ((select private.can_edit('projects'))
             or (advance_id is not null and (select private.can_edit('advances')) and (select private.can_see_advance(advance_id)))))
  );
