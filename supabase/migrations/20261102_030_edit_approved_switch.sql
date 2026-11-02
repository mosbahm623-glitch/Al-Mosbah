-- A per-user switch: may he edit his own APPROVED entries (default: no, as before). An edit sends the entry back to the admin for approval.
alter table public.profiles add column can_edit_approved boolean not null default false;

create or replace function private.can_edit_approved_entries()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_staff() or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_active and p.can_edit_approved
  );
$$;
revoke execute on function private.can_edit_approved_entries() from public, anon;
grant execute on function private.can_edit_approved_entries() to authenticated;

drop policy if exists entries_update on public.entries;
create policy entries_update on public.entries for update to authenticated
  using (
    status <> 'deleted'
    and (
      (select private.is_staff())
      or (created_by = (select auth.uid())
          and (status <> 'approved' or (select private.can_edit_approved_entries()))
          and (select private.can_edit_own_entries())
          and ((select private.can_edit('projects'))
               or (advance_id is not null and (select private.can_edit('advances')) and (select private.can_see_advance(advance_id)))))
    )
  )
  with check (
    (select private.is_staff())
    or (created_by = (select auth.uid())
        and (select private.can_edit_own_entries())
        and ((select private.can_edit('projects'))
             or (advance_id is not null and (select private.can_edit('advances')) and (select private.can_see_advance(advance_id)))))
  );
