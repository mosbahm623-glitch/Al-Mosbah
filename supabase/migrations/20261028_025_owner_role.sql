-- Owner role: every permission of an admin EXCEPT approving. Only an admin approves (and restores deleted entries);
-- an owner's own entries wait for approval like anyone else's. Only an admin can create or change an admin account.
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin', 'owner', 'user'));

create or replace function private.is_owner() returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and is_active and role = 'owner');
$$;
create or replace function private.is_staff() returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and is_active and role in ('admin', 'owner'));
$$;

-- everything that meant "full access" now means admin or owner; approving (is_admin) is left alone in
-- private.entry_approval_flow() and public.restore_entry()
do $$
declare f text; r record; q text; w text;
begin
  foreach f in array array['private.can_view(text)', 'private.can_edit(text)', 'private.has_any_access()', 'private.can_see_advance(uuid)',
                           'public.entry_history_of(uuid)', 'public.deleted_entries()', 'public.delete_entry(uuid,integer,text)'] loop
    execute replace(pg_get_functiondef(f::regprocedure), 'private.is_admin()', 'private.is_staff()');
  end loop;
  for r in
    select c.relname, p.polname, pg_get_expr(p.polqual, p.polrelid) as q, pg_get_expr(p.polwithcheck, p.polrelid) as w
    from pg_policy p join pg_class c on c.oid = p.polrelid join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname <> 'profiles'
      and (pg_get_expr(p.polqual, p.polrelid) ilike '%private.is_admin()%' or pg_get_expr(p.polwithcheck, p.polrelid) ilike '%private.is_admin()%')
  loop
    q := replace(r.q, 'private.is_admin()', 'private.is_staff()');
    w := replace(r.w, 'private.is_admin()', 'private.is_staff()');
    execute format('alter policy %I on public.%I %s %s', r.polname, r.relname,
      case when r.q is not null then 'using (' || q || ')' else '' end,
      case when r.w is not null then 'with check (' || w || ')' else '' end);
  end loop;
end $$;

drop policy profiles_update_admin on public.profiles;
create policy profiles_update_staff on public.profiles for update to authenticated
  using ((select private.is_admin()) or ((select private.is_owner()) and role <> 'admin'))
  with check ((select private.is_admin()) or ((select private.is_owner()) and role <> 'admin'));
