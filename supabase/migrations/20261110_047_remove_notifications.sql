-- مسح نظام الإشعارات بالكامل (هنبنيه من جديد): الـ triggers والدوال والجداول وعمود تنبيه الرصيد،
-- وشيل مجموعة «الإشعارات» من إعادة ضبط البيانات.
drop trigger if exists entries_notify on public.entries;
drop trigger if exists entries_low_balance on public.entries;
drop trigger if exists installment_notify on public.advance_installments;
drop trigger if exists notifications_push on public.notifications;

drop function if exists private.notify_entry_change();
drop function if exists private.notify_installment_change();
drop function if exists private.check_low_balance();
drop function if exists private.push_notification();
drop function if exists public.send_message(uuid[], text, text);
drop function if exists public.send_low_balance_reminder();
drop function if exists public.push_config();
drop function if exists private.low_balance_threshold();
drop function if exists private.project_balance(uuid);

drop table if exists private.project_low_balance;
drop table if exists private.push_config;
drop table if exists public.push_subscriptions;
drop table if exists public.notifications;
alter table public.profiles drop column if exists notify_low_balance;

drop function if exists public.reset_data(text[]);
create function public.reset_data(p_groups text[] default array['entries', 'contractor_dues', 'projects', 'contractors', 'advances', 'banks', 'categories'])
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
     or not (g <@ array['entries', 'contractor_dues', 'projects', 'contractors', 'advances', 'banks', 'categories', 'users']) then
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

  if 'entries' = any (g) then
    t := t || array['public.entry_attachments', 'public.entry_history', 'public.entries', 'public.entry_counters'];
  end if;
  if 'contractor_dues' = any (g) then
    t := t || array['public.contractor_transactions', 'public.contractor_settlements'];
  end if;
  if 'projects' = any (g) then
    t := t || array['public.projects'];
  end if;
  if 'contractors' = any (g) then
    t := t || array['public.contractors'];
  end if;
  if 'advances' = any (g) then
    t := t || array['public.advance_installments', 'public.pending_advance_installments', 'public.advance_returns',
                    'public.user_advance_access', 'public.advances'];
  end if;
  if 'banks' = any (g) then
    t := t || array['public.user_bank_access', 'public.bank_accounts'];
  end if;
  if 'categories' = any (g) then
    t := t || array['public.expense_items', 'public.expense_categories'];
  end if;
  if cardinality(t) > 0 then
    execute 'truncate table ' || array_to_string(t, ', ') || ' restart identity';
  end if;

  if 'users' = any (g) then
    delete from public.backup_log where "by" is distinct from me;
    delete from private.allowed_emails where email in (select lower(u.email) from auth.users u where u.id <> me);
    delete from auth.users where id <> me;
  end if;

  update public.data_pings set at = now() where id = 1;
end;
$$;
revoke execute on function public.reset_data(text[]) from public, anon;
grant execute on function public.reset_data(text[]) to authenticated;
