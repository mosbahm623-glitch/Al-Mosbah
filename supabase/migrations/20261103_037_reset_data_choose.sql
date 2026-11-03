-- إعادة الضبط بالاختيار: الأدمن يحدد أي مجموعات بيانات تتمسح. من غير اختيار بتمسح كل بيانات التشغيل (زي الأول) وتسيب المستخدمين.
-- المجموعات: entries (القيود وصور الفواتير وسجل التعديل وترقيم القيود)، contractor_dues (حركات المقاولين وتسوياتهم)،
-- projects، contractors (أسماء المقاولين)، advances (العهد بدفعاتها ومرتجعاتها)، banks، categories (البنود)، notifications،
-- users (كل المستخدمين ماعدا حساب الأدمن اللي بينفّذ).
-- مجموعة بتشاور عليها بيانات تانية ما تتمسحش لوحدها: الدالة بترفض لو المجموعات المطلوبة معاها مش مختارة (مفيش مسح إضافي بالغلط).
drop function if exists public.reset_data();

create or replace function public.reset_data(
  p_groups text[] default array['entries', 'contractor_dues', 'projects', 'contractors', 'advances', 'banks', 'categories', 'notifications']
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  g text[] := coalesce(p_groups, '{}');
  me uuid := (select auth.uid());
  t text[] := '{}';
begin
  if not (select private.is_admin()) then
    raise exception 'admin only' using errcode = '42501';
  end if;

  if cardinality(g) = 0
     or not (g <@ array['entries', 'contractor_dues', 'projects', 'contractors', 'advances', 'banks', 'categories', 'notifications', 'users']) then
    raise exception 'unknown or empty selection' using errcode = '22023';
  end if;

  if (g && array['projects', 'contractors']) and not (g @> array['entries', 'contractor_dues']) then
    raise exception 'projects and contractors need entries and contractor_dues' using errcode = '22023';
  end if;
  if (g && array['advances', 'banks']) and not (g @> array['entries']) then
    raise exception 'advances and banks need entries' using errcode = '22023';
  end if;
  if 'users' = any (g) and not (g @> array['entries', 'contractor_dues', 'advances']) then
    raise exception 'users need entries, contractor_dues and advances' using errcode = '22023';
  end if;

  -- one TRUNCATE for the chosen tables: if some other table still points at one of them, it fails and nothing is deleted
  if 'entries' = any (g) then
    t := t || array['public.entry_attachments', 'public.entry_history', 'public.entries', 'public.entry_counters'];
  end if;
  if 'contractor_dues' = any (g) then
    t := t || array['public.contractor_transactions', 'public.contractor_settlements'];
  end if;
  if 'projects' = any (g) then
    t := t || array['private.project_low_balance', 'public.projects'];
  end if;
  if 'contractors' = any (g) then
    t := t || array['public.contractors'];
  end if;
  if 'advances' = any (g) then
    t := t || array['public.advance_installments', 'public.pending_advance_installments', 'public.advance_returns',
                    'public.user_advance_access', 'public.advances'];
  end if;
  if 'banks' = any (g) then
    t := t || array['public.bank_accounts'];
  end if;
  if 'categories' = any (g) then
    t := t || array['public.expense_items', 'public.expense_categories'];
  end if;
  if 'notifications' = any (g) then
    t := t || array['public.notifications'];
  end if;
  if cardinality(t) > 0 then
    execute 'truncate table ' || array_to_string(t, ', ') || ' restart identity';
  end if;

  -- every account but the admin's own: their sign-in goes (profiles, permissions, device subscriptions follow),
  -- and their e-mails leave the sign-up list so nobody can register again by himself
  if 'users' = any (g) then
    delete from public.backup_log where "by" is distinct from me;
    delete from private.allowed_emails where email in (select lower(u.email) from auth.users u where u.id <> me);
    delete from auth.users where id <> me;
  end if;

  -- the screens that are open on other devices refresh by themselves
  update public.data_pings set at = now() where id = 1;
end;
$$;

revoke execute on function public.reset_data(text[]) from public, anon;
grant execute on function public.reset_data(text[]) to authenticated;
