-- Per-user switches: may he edit his own entries, may he delete them (default: yes, as before). Staff are never limited.
alter table public.profiles
  add column can_edit_entries boolean not null default true,
  add column can_delete_entries boolean not null default true;

create or replace function private.can_edit_own_entries()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_staff() or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_active and p.can_edit_entries
  );
$$;

create or replace function private.can_delete_own_entries()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_staff() or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_active and p.can_delete_entries
  );
$$;

revoke execute on function private.can_edit_own_entries(), private.can_delete_own_entries() from public, anon;
grant execute on function private.can_edit_own_entries(), private.can_delete_own_entries() to authenticated;

drop policy if exists entries_update on public.entries;
create policy entries_update on public.entries for update to authenticated
  using (
    status <> 'deleted'
    and (
      (select private.is_staff())
      or (created_by = (select auth.uid()) and status <> 'approved'
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

create or replace function public.delete_entry(p_id uuid, p_rev integer, p_reason text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare e public.entries; uid uuid := (select auth.uid()); r text := btrim(coalesce(p_reason, ''));
begin
  if char_length(r) < 2 then raise exception 'reason required' using errcode = '22023'; end if;
  select * into e from public.entries where id = p_id for update;
  if not found or e.status = 'deleted' or e.rev <> p_rev then return false; end if;
  if not (private.is_staff() or (e.created_by = uid and e.status <> 'approved'
      and private.can_delete_own_entries()
      and (private.can_edit('projects') or (e.advance_id is not null and private.can_edit('advances') and private.can_see_advance(e.advance_id))))) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  perform set_config('app.entry_action', 'delete', true);
  update public.entries set status = 'deleted', status_before_delete = e.status, deleted_at = now(), deleted_by = uid, delete_reason = r where id = p_id;
  perform set_config('app.entry_action', '', true);
  update public.data_pings set at = now() where id = 1;
  return true;
end;
$$;
