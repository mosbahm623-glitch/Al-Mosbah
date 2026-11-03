-- البنوك اللي المالك (أو أي مستخدم غير الأدمن) يصرف منها: الأدمن بيحدّدها لكل واحد.
-- لو الواحد ملوش صفوف هنا يصرف من أي بنك زي ما كان. لو ليه صفوف يبقى المصروفات اللي بيسجّلها بتتقيّد بالبنوك دي بس.
-- القيد من غير بنك (أو من عهدة) والوارد (اتودّع في بنك) مش متقيّدين: القيد هو الصرف من بنك.
create table public.user_bank_access (
  user_id uuid not null references public.profiles (id) on delete cascade,
  bank_id uuid not null references public.bank_accounts (id) on delete cascade,
  primary key (user_id, bank_id)
);
create index user_bank_access_bank_id_idx on public.user_bank_access (bank_id);
alter table public.user_bank_access enable row level security;

-- the person sees his own limits (the form needs them); only the admin sets them, so nobody can lift his own limit
create policy user_bank_access_select on public.user_bank_access for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy user_bank_access_insert on public.user_bank_access for insert to authenticated
  with check ((select private.is_admin()));
create policy user_bank_access_delete on public.user_bank_access for delete to authenticated
  using ((select private.is_admin()));

-- an expense can be recorded only against a bank the person may spend from. The admin is never limited, and an old
-- entry keeps its bank when it is edited (the check runs only when the bank or the kind changes).
create function private.entry_bank_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null or new.kind <> 'expense' or new.bank_id is null or private.is_admin() then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.bank_id is not distinct from old.bank_id and new.kind = old.kind then
    return new;
  end if;
  if exists (select 1 from public.user_bank_access where user_id = uid)
     and not exists (select 1 from public.user_bank_access where user_id = uid and bank_id = new.bank_id) then
    raise exception 'bank not allowed' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function private.entry_bank_access() from public, anon, authenticated;
create trigger entry_bank_access before insert or update on public.entries
  for each row execute function private.entry_bank_access();

-- the reset (037) wipes the banks: the limits that point at them go with them
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
    t := t || array['public.user_bank_access', 'public.bank_accounts'];
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

  if 'users' = any (g) then
    delete from public.backup_log where "by" is distinct from me;
    delete from private.allowed_emails where email in (select lower(u.email) from auth.users u where u.id <> me);
    delete from auth.users where id <> me;
  end if;

  update public.data_pings set at = now() where id = 1;
end;
$$;
