-- Every edit of an entry carries a reason, kept for good in the entry history (who changed what, and why).
alter table public.entries add column edit_reason text;

-- The only way to change the content of an entry: the reason travels with the update.
create or replace function public.edit_entry(p_id uuid, p_rev integer, p_reason text, p_row jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare r text := btrim(coalesce(p_reason, '')); n integer;
begin
  if char_length(r) < 2 then raise exception 'reason required' using errcode = '22023'; end if;
  perform set_config('app.edit_reason', r, true);
  update public.entries set
    project_id = (p_row->>'project_id')::uuid,
    kind = p_row->>'kind',
    category = p_row->>'category',
    item = p_row->>'item',
    contractor_id = (p_row->>'contractor_id')::uuid,
    bank_id = (p_row->>'bank_id')::uuid,
    amount = (p_row->>'amount')::numeric,
    entry_date = (p_row->>'entry_date')::date,
    notes = p_row->>'notes'
  where id = p_id and rev = p_rev;
  get diagnostics n = row_count;
  perform set_config('app.edit_reason', '', true);
  return n > 0;
end;
$$;
revoke execute on function public.edit_entry(uuid, integer, text, jsonb) from public, anon;
grant execute on function public.edit_entry(uuid, integer, text, jsonb) to authenticated;

create or replace function private.entry_approval_flow()
returns trigger language plpgsql security definer set search_path = '' as $$
declare y integer; n integer; why text := nullif(current_setting('app.edit_reason', true), ''); changed boolean;
begin
  if tg_op = 'INSERT' then
    y := extract(year from now() at time zone 'Africa/Cairo')::int;
    insert into public.entry_counters as c (year, last) values (y, 1) on conflict (year) do update set last = c.last + 1 returning c.last into n;
    if n > 9999 then raise exception 'entry numbers of % are used up (9999)', y; end if;
    new.seq := y * 10000 + n; new.rev := 1; new.created_by := (select auth.uid());
    new.decided_by := null; new.decided_at := null; new.reject_reason := null; new.edit_reason := null;
    new.deleted_at := null; new.deleted_by := null; new.status_before_delete := null; new.delete_reason := null;
    new.status := case when private.is_admin() or (select auth.uid()) is null then 'approved' else 'pending' end;
  else
    new.seq := old.seq; new.rev := old.rev + 1; new.created_by := old.created_by;
    if current_setting('app.entry_action', true) in ('delete', 'restore') then return new; end if;
    new.deleted_at := old.deleted_at; new.deleted_by := old.deleted_by; new.status_before_delete := old.status_before_delete; new.delete_reason := old.delete_reason;
    if new.status = 'deleted' then new.status := old.status; end if;
    -- a change to what the entry says needs a reason (given through edit_entry); approving / rejecting does not
    changed := (new.project_id, new.kind, new.category, new.item, new.contractor_id, new.bank_id, new.amount, new.entry_date, new.notes, new.advance_id)
      is distinct from (old.project_id, old.kind, old.category, old.item, old.contractor_id, old.bank_id, old.amount, old.entry_date, old.notes, old.advance_id);
    if why is not null then new.edit_reason := why;
    elsif changed then raise exception 'edit reason required' using errcode = '22023';
    else new.edit_reason := old.edit_reason; end if;
    if private.is_admin() or (select auth.uid()) is null then
      if new.status is distinct from old.status then
        new.decided_by := (select auth.uid()); new.decided_at := now();
        if new.status = 'rejected' then
          new.reject_reason := btrim(coalesce(new.reject_reason, ''));
          if char_length(new.reject_reason) < 2 then raise exception 'reason required' using errcode = '22023'; end if;
        else
          new.reject_reason := null;
        end if;
      else
        new.decided_by := old.decided_by; new.decided_at := old.decided_at; new.reject_reason := old.reject_reason;
      end if;
    else
      new.status := 'pending'; new.decided_by := null; new.decided_at := null; new.reject_reason := null;
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.notify_entry_change()
returns trigger language plpgsql security definer set search_path = '' as $$
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
    select p.id, 'pending', 'قيد اتعدّل ومستنّي موافقتك' || coalesce(' من ' || who, ''), txt || coalesce(' · سبب التعديل: ' || new.edit_reason, ''), '#/approvals', new.id
    from public.profiles p where p.role = 'admin' and p.is_active and p.id is distinct from actor;
  elsif new.status in ('approved', 'rejected') and new.created_by is distinct from actor and new.created_by is not null then
    if new.status = 'rejected' then txt := txt || coalesce(' · السبب: ' || new.reject_reason, ''); end if;
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
$$;
