-- A deleted entry carries the reason its deleter gave (required).
alter table public.entries add column delete_reason text;

create or replace function private.entry_approval_flow()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare y integer; n integer;
begin
  if tg_op = 'INSERT' then
    y := extract(year from now() at time zone 'Africa/Cairo')::int;
    insert into public.entry_counters as c (year, last) values (y, 1) on conflict (year) do update set last = c.last + 1 returning c.last into n;
    if n > 9999 then raise exception 'entry numbers of % are used up (9999)', y; end if;
    new.seq := y * 10000 + n; new.rev := 1; new.created_by := (select auth.uid());
    new.decided_by := null; new.decided_at := null;
    new.deleted_at := null; new.deleted_by := null; new.status_before_delete := null; new.delete_reason := null;
    new.status := case when private.is_admin() or (select auth.uid()) is null then 'approved' else 'pending' end;
  else
    new.seq := old.seq; new.rev := old.rev + 1; new.created_by := old.created_by;
    if current_setting('app.entry_action', true) in ('delete', 'restore') then return new; end if;
    new.deleted_at := old.deleted_at; new.deleted_by := old.deleted_by; new.status_before_delete := old.status_before_delete; new.delete_reason := old.delete_reason;
    if new.status = 'deleted' then new.status := old.status; end if;
    if private.is_admin() or (select auth.uid()) is null then
      if new.status is distinct from old.status then new.decided_by := (select auth.uid()); new.decided_at := now();
      else new.decided_by := old.decided_by; new.decided_at := old.decided_at; end if;
    else new.status := 'pending'; new.decided_by := null; new.decided_at := null; end if;
  end if;
  return new;
end;
$function$;

drop function public.delete_entry(uuid, integer);
create or replace function public.delete_entry(p_id uuid, p_rev integer, p_reason text)
returns boolean language plpgsql security definer set search_path to '' as $function$
declare e public.entries; uid uuid := (select auth.uid()); r text := btrim(coalesce(p_reason, ''));
begin
  if char_length(r) < 2 then raise exception 'reason required' using errcode = '22023'; end if;
  select * into e from public.entries where id = p_id for update;
  if not found or e.status = 'deleted' or e.rev <> p_rev then return false; end if;
  if not (private.is_admin() or (e.created_by = uid and e.status <> 'approved'
      and (private.can_edit('projects') or (e.advance_id is not null and private.can_edit('advances') and private.can_see_advance(e.advance_id))))) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  perform set_config('app.entry_action', 'delete', true);
  update public.entries set status = 'deleted', status_before_delete = e.status, deleted_at = now(), deleted_by = uid, delete_reason = r where id = p_id;
  perform set_config('app.entry_action', '', true);
  update public.data_pings set at = now() where id = 1;
  return true;
end;
$function$;
revoke all on function public.delete_entry(uuid, integer, text) from public, anon;
grant execute on function public.delete_entry(uuid, integer, text) to authenticated;

create or replace function public.restore_entry(p_id uuid)
returns boolean language plpgsql security definer set search_path to '' as $function$
declare e public.entries;
begin
  if not private.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into e from public.entries where id = p_id for update;
  if not found or e.status <> 'deleted' then return false; end if;
  perform set_config('app.entry_action', 'restore', true);
  update public.entries set status = coalesce(e.status_before_delete, 'approved'), status_before_delete = null, deleted_at = null, deleted_by = null, delete_reason = null where id = p_id;
  perform set_config('app.entry_action', '', true);
  update public.data_pings set at = now() where id = 1;
  return true;
end;
$function$;

create or replace function public.deleted_entries()
returns jsonb language sql stable security definer set search_path to '' as $function$
  select coalesce(jsonb_agg(r order by r.deleted_at desc), '[]'::jsonb) from (
    select e.id, e.seq, e.kind, e.category, e.item, e.amount, e.entry_date, e.notes, e.rev, e.status_before_delete, e.deleted_at, e.delete_reason,
           p.name as project, c.name as contractor, d.full_name as deleted_by_name, u.full_name as created_by_name
    from public.entries e
    left join public.projects p on p.id = e.project_id left join public.contractors c on c.id = e.contractor_id
    left join public.profiles d on d.id = e.deleted_by left join public.profiles u on u.id = e.created_by
    where e.status = 'deleted') r
  where private.is_admin();
$function$;

create or replace function public.project_deleted_entries(p_project uuid)
returns jsonb language sql stable security definer set search_path to '' as $function$
  select coalesce(jsonb_agg(r order by r.deleted_at desc), '[]'::jsonb) from (
    select e.id, e.seq, e.kind, e.category, e.item, e.amount, e.entry_date, e.notes, e.rev, e.status_before_delete, e.deleted_at, e.delete_reason,
           p.name as project, c.name as contractor, d.full_name as deleted_by_name, u.full_name as created_by_name
    from public.entries e
    left join public.projects p on p.id = e.project_id left join public.contractors c on c.id = e.contractor_id
    left join public.profiles d on d.id = e.deleted_by left join public.profiles u on u.id = e.created_by
    where e.status = 'deleted' and e.project_id = p_project) r
  where private.can_view('projects');
$function$;

-- the reason travels in the notification text
create or replace function private.notify_entry_change()
returns trigger language plpgsql security definer set search_path to '' as $f$
declare
  actor uuid := (select auth.uid()); who text; proj text; txt text; link text := '#/search?q=' || new.seq;
begin
  select full_name into who from public.profiles where id = actor;
  select name into proj from public.projects where id = new.project_id;
  txt := 'قيد #' || new.seq || ' · ' || coalesce(proj, '') || ' · ' || new.category || coalesce(' · ' || new.item, '') || ' · ' || new.amount::text || ' ج.م';

  if tg_op = 'INSERT' then
    if new.status = 'pending' then
      insert into public.notifications (user_id, kind, title, body, url, entry_id)
      select p.id, 'pending', 'قيد جديد مستنّي موافقتك' || coalesce(' من ' || who, ''), txt, '#/approvals', new.id
      from public.profiles p where p.role = 'admin' and p.is_active and p.id is distinct from actor;
    end if;
    return new;
  end if;
  if new.status is not distinct from old.status then return new; end if;

  if new.status = 'pending' then
    insert into public.notifications (user_id, kind, title, body, url, entry_id)
    select p.id, 'pending', 'قيد اتعدّل ومستنّي موافقتك' || coalesce(' من ' || who, ''), txt, '#/approvals', new.id
    from public.profiles p where p.role = 'admin' and p.is_active and p.id is distinct from actor;
  elsif new.status in ('approved', 'rejected') and new.created_by is distinct from actor and new.created_by is not null then
    insert into public.notifications (user_id, kind, title, body, url, entry_id)
    values (new.created_by, new.status, case when new.status = 'approved' then 'اتوافق على قيدك' else 'اترفض قيدك' end, txt, link, new.id);
  elsif new.status = 'deleted' then
    txt := txt || coalesce(' · السبب: ' || new.delete_reason, '');
    if new.created_by is not null and new.created_by is distinct from actor then
      insert into public.notifications (user_id, kind, title, body, url, entry_id)
      values (new.created_by, 'deleted', 'قيدك اتمسح' || coalesce(' بواسطة ' || who, ''), txt, '#/projects/' || new.project_id, new.id);
    end if;
    if new.status_before_delete = 'approved' then
      insert into public.notifications (user_id, kind, title, body, url, entry_id)
      select p.id, 'deleted', 'اتمسح قيد معتمد' || coalesce(' بواسطة ' || who, ''), txt, '#/approvals', new.id
      from public.profiles p where p.role = 'admin' and p.is_active and p.id is distinct from actor and p.id is distinct from new.created_by;
    end if;
  elsif old.status = 'deleted' and new.created_by is not null and new.created_by is distinct from actor then
    insert into public.notifications (user_id, kind, title, body, url, entry_id)
    values (new.created_by, 'restored', 'قيدك اتسترجع', txt, link, new.id);
  end if;
  return new;
exception when others then
  return new;
end;
$f$;
