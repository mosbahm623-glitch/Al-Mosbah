-- تعديل المستخدم لقيد معتمد: يفضل معتمد (مش بيرجع للموافقات) ويتبعت للأدمن إشعار بالتغيير والسبب.
-- القيد المعلّق/المرفوض لو اتعدّل يفضل يرجع معلّق زي الأول.

create or replace function private.entry_approval_flow()
returns trigger language plpgsql security definer set search_path = '' as $function$
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
    elsif old.status = 'approved' then
      new.status := 'approved'; new.decided_by := old.decided_by; new.decided_at := old.decided_at; new.reject_reason := null;
    else
      new.status := 'pending'; new.decided_by := null; new.decided_at := null; new.reject_reason := null;
    end if;
  end if;
  return new;
end;
$function$;

create or replace function private.notify_entry_change()
returns trigger language plpgsql security definer set search_path = '' as $function$
declare
  actor uuid := (select auth.uid()); who text; proj text; txt text; link text := '#/search?q=' || new.seq;
  diff text := ''; a text; b text;
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

  -- مستخدم عدّل قيد معتمد: يفضل معتمد + إشعار للأدمن بالتغيير والسبب
  if new.status = 'approved' and old.status = 'approved' and actor is not null and not private.is_admin() then
    if new.project_id is distinct from old.project_id then
      select name into a from public.projects where id = old.project_id;
      diff := diff || '، المشروع: ' || coalesce(a, '—') || ' ← ' || coalesce(proj, '—');
    end if;
    if new.kind is distinct from old.kind then
      diff := diff || '، النوع: ' || case old.kind when 'income' then 'وارد' else 'مصروف' end || ' ← ' || case new.kind when 'income' then 'وارد' else 'مصروف' end;
    end if;
    if new.category is distinct from old.category then diff := diff || '، التصنيف: ' || coalesce(old.category, '—') || ' ← ' || coalesce(new.category, '—'); end if;
    if new.item is distinct from old.item then diff := diff || '، البند: ' || coalesce(old.item, '—') || ' ← ' || coalesce(new.item, '—'); end if;
    if new.amount is distinct from old.amount then diff := diff || '، المبلغ: ' || old.amount::text || ' ← ' || new.amount::text; end if;
    if new.entry_date is distinct from old.entry_date then diff := diff || '، التاريخ: ' || old.entry_date::text || ' ← ' || new.entry_date::text; end if;
    if new.contractor_id is distinct from old.contractor_id then
      select name into a from public.contractors where id = old.contractor_id;
      select name into b from public.contractors where id = new.contractor_id;
      diff := diff || '، المقاول: ' || coalesce(a, '—') || ' ← ' || coalesce(b, '—');
    end if;
    if new.bank_id is distinct from old.bank_id then
      select name into a from public.bank_accounts where id = old.bank_id;
      select name into b from public.bank_accounts where id = new.bank_id;
      diff := diff || '، البنك: ' || coalesce(a, '—') || ' ← ' || coalesce(b, '—');
    end if;
    if new.notes is distinct from old.notes then diff := diff || '، الملاحظات: ' || coalesce(old.notes, '—') || ' ← ' || coalesce(new.notes, '—'); end if;
    if diff = '' then diff := '، لا تغيير في البيانات (مثلاً إضافة فاتورة)'; end if;
    insert into public.notifications (user_id, kind, title, body, url, entry_id)
    select p.id, 'edited', 'اتعدّل قيد معتمد' || coalesce(' بواسطة ' || who, ''),
           'قيد #' || new.seq || ' · ' || coalesce(proj, '') || ' — اللي اتغيّر: ' || substr(diff, 3) || ' — السبب: ' || coalesce(new.edit_reason, '—'),
           '#/search?q=' || new.seq, new.id
    from public.profiles p where p.role = 'admin' and p.is_active and p.id is distinct from actor;
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
$function$;
