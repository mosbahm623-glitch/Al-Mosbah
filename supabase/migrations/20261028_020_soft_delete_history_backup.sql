-- Soft delete, change history, live pings and a backup log.
--  * Deleting an entry only marks it status = 'deleted' (who / when / what it was before). Every total in the app counts
--    status = 'approved' only, so a deleted entry disappears from all numbers; row security hides it from every list.
--    Only admins can see the trash and restore.
--  * entry_history keeps every version change of an entry (old and new row, by whom).
--  * data_pings is touched on delete/restore so other open screens refresh (a hidden row sends no change event itself).
--  * backup_log remembers when an admin last downloaded a backup (the free plan has no automatic backups).

alter table public.entries drop constraint entries_status_check;
alter table public.entries add constraint entries_status_check check (status in ('pending', 'approved', 'rejected', 'deleted'));
alter table public.entries
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.profiles (id),
  add column status_before_delete text;
create index entries_deleted_by_idx on public.entries (deleted_by);

-- ---------- history ----------
create table public.entry_history (
  id bigint generated always as identity primary key,
  entry_id uuid not null,
  seq bigint,
  action text not null,
  old_row jsonb not null,
  new_row jsonb,
  changed_by uuid,
  changed_at timestamptz not null default now()
);
create index entry_history_entry_idx on public.entry_history (entry_id, changed_at);
alter table public.entry_history enable row level security;
create policy entry_history_admin_read on public.entry_history for select to authenticated using ((select private.is_admin()));

create or replace function private.log_entry_change()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare act text;
begin
  if tg_op = 'DELETE' then
    insert into public.entry_history (entry_id, seq, action, old_row, changed_by)
    values (old.id, old.seq, 'hard_delete', to_jsonb(old), (select auth.uid()));
    return old;
  end if;
  act := case
    when new.status = 'deleted' and old.status <> 'deleted' then 'delete'
    when old.status = 'deleted' and new.status <> 'deleted' then 'restore'
    when new.status = 'approved' and old.status <> 'approved' then 'approve'
    when new.status = 'rejected' and old.status <> 'rejected' then 'reject'
    else 'edit'
  end;
  insert into public.entry_history (entry_id, seq, action, old_row, new_row, changed_by)
  values (old.id, old.seq, act, to_jsonb(old), to_jsonb(new), (select auth.uid()));
  return new;
end;
$function$;
create trigger entry_history_log after update or delete on public.entries for each row execute function private.log_entry_change();

-- ---------- the approval trigger: protects the delete columns, honours the delete / restore functions ----------
create or replace function private.entry_approval_flow()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  y integer;
  n integer;
begin
  if tg_op = 'INSERT' then
    y := extract(year from now() at time zone 'Africa/Cairo')::int;
    insert into public.entry_counters as c (year, last) values (y, 1)
      on conflict (year) do update set last = c.last + 1
      returning c.last into n;
    if n > 9999 then
      raise exception 'entry numbers of % are used up (9999)', y;
    end if;
    new.seq := y * 10000 + n;
    new.rev := 1;
    new.created_by := (select auth.uid());
    new.decided_by := null;
    new.decided_at := null;
    new.deleted_at := null;
    new.deleted_by := null;
    new.status_before_delete := null;
    new.status := case when private.is_admin() or (select auth.uid()) is null then 'approved' else 'pending' end;
  else
    new.seq := old.seq;
    new.rev := old.rev + 1;
    new.created_by := old.created_by;
    if current_setting('app.entry_action', true) in ('delete', 'restore') then
      -- set by delete_entry / restore_entry only (they check who may do it)
      return new;
    end if;
    new.deleted_at := old.deleted_at;
    new.deleted_by := old.deleted_by;
    new.status_before_delete := old.status_before_delete;
    if new.status = 'deleted' then new.status := old.status; end if;
    if private.is_admin() or (select auth.uid()) is null then
      if new.status is distinct from old.status then
        new.decided_by := (select auth.uid());
        new.decided_at := now();
      else
        new.decided_by := old.decided_by;
        new.decided_at := old.decided_at;
      end if;
    else
      new.status := 'pending';
      new.decided_by := null;
      new.decided_at := null;
    end if;
  end if;
  return new;
end;
$function$;

-- ---------- row security: deleted rows are invisible and untouchable; no hard delete from the app ----------
alter policy entries_select on public.entries using (
  status <> 'deleted' and (
    (select private.can_view('projects'))
    or (advance_id is not null and (select private.can_view('advances')) and (select private.can_see_advance(advance_id)))
  )
);
alter policy entries_update on public.entries using (
  status <> 'deleted' and (
    (select private.is_admin())
    or (
      created_by = (select auth.uid()) and status <> 'approved'
      and ((select private.can_edit('projects')) or (advance_id is not null and (select private.can_edit('advances')) and (select private.can_see_advance(advance_id))))
    )
  )
);
drop policy entries_delete on public.entries;

-- ---------- live pings ----------
create table public.data_pings (id integer primary key, at timestamptz not null default now());
insert into public.data_pings (id) values (1);
alter table public.data_pings enable row level security;
create policy data_pings_read on public.data_pings for select to authenticated using (true);
alter publication supabase_realtime add table public.data_pings;

-- ---------- functions ----------
create or replace function public.delete_entry(p_id uuid, p_rev integer)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  e public.entries;
  uid uuid := (select auth.uid());
begin
  select * into e from public.entries where id = p_id for update;
  if not found or e.status = 'deleted' or e.rev <> p_rev then return false; end if;
  if not (
    private.is_admin()
    or (
      e.created_by = uid and e.status <> 'approved'
      and (private.can_edit('projects') or (e.advance_id is not null and private.can_edit('advances') and private.can_see_advance(e.advance_id)))
    )
  ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  perform set_config('app.entry_action', 'delete', true);
  update public.entries set status = 'deleted', status_before_delete = e.status, deleted_at = now(), deleted_by = uid where id = p_id;
  perform set_config('app.entry_action', '', true);
  update public.data_pings set at = now() where id = 1;
  return true;
end;
$function$;

create or replace function public.restore_entry(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare e public.entries;
begin
  if not private.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into e from public.entries where id = p_id for update;
  if not found or e.status <> 'deleted' then return false; end if;
  perform set_config('app.entry_action', 'restore', true);
  update public.entries set status = coalesce(e.status_before_delete, 'approved'), status_before_delete = null, deleted_at = null, deleted_by = null where id = p_id;
  perform set_config('app.entry_action', '', true);
  update public.data_pings set at = now() where id = 1;
  return true;
end;
$function$;

create or replace function public.deleted_entries()
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
    where e.status = 'deleted'
  ) r
  where private.is_admin();
$function$;

create or replace function public.entry_history_of(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(jsonb_agg(r order by r.changed_at), '[]'::jsonb)
  from (
    select h.id, h.action, h.old_row, h.new_row, h.changed_at, pr.full_name as changed_by_name
    from public.entry_history h
    left join public.profiles pr on pr.id = h.changed_by
    where h.entry_id = p_id
  ) r
  where private.is_admin();
$function$;

revoke all on function public.delete_entry(uuid, integer), public.restore_entry(uuid), public.deleted_entries(), public.entry_history_of(uuid) from public, anon;
grant execute on function public.delete_entry(uuid, integer), public.restore_entry(uuid), public.deleted_entries(), public.entry_history_of(uuid) to authenticated;

-- ---------- backup log ----------
create table public.backup_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  by uuid references public.profiles (id),
  note text
);
create index backup_log_by_idx on public.backup_log (by);
alter table public.backup_log enable row level security;
create policy backup_log_read on public.backup_log for select to authenticated using ((select private.is_admin()));
create policy backup_log_insert on public.backup_log for insert to authenticated with check ((select private.is_admin()) and by = (select auth.uid()));
