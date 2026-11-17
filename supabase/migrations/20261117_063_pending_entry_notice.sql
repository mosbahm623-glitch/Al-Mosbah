-- إشعار للأدمن لما قيد جديد يدخل الموافقات (قيد جديد بحالة pending، أو قيد اتعاد للموافقات).
-- بيوصل في التطبيق لحظيًا وعلى التليفون (نفس مسار باقي الإشعارات). اللي عمل الحركة نفسه ما بيجيلوش إشعار.

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check check (kind in ('low_balance', 'test', 'pending_entry'));

create function private.notify_pending_entry()
returns trigger language plpgsql security definer set search_path to '' as $f$
declare
  proj_name text;
  who text;
begin
  begin
    if new.status is distinct from 'pending' then return new; end if;
    if tg_op = 'UPDATE' and old.status is not distinct from 'pending' then return new; end if;

    select name into proj_name from public.projects where id = new.project_id;
    select coalesce(nullif(btrim(full_name), ''), 'مستخدم') into who from public.profiles where id = new.created_by;

    insert into public.notifications (user_id, kind, title, body, url)
    select p.id, 'pending_entry', 'قيد مستني موافقتك',
           coalesce(who, 'مستخدم') || ' · ' || case when new.kind = 'income' then 'وارد' else 'مصروف' end
             || ' ' || to_char(round(new.amount), 'FM999,999,999') || ' ج.م · «' || coalesce(proj_name, '—') || '»',
           '#/approvals'
    from public.profiles p
    where p.is_active and p.role = 'admin' and p.id is distinct from (select auth.uid());
  exception when others then
    null; -- مشكلة في الإشعار ما توقفش حفظ القيد أبدًا
  end;
  return new;
end;
$f$;
revoke all on function private.notify_pending_entry() from public, anon, authenticated;

create trigger entries_notify_pending after insert or update of status on public.entries
  for each row execute function private.notify_pending_entry();
