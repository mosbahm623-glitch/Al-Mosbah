-- تحويل بين عهدتين: حركة واحدة بتسجّل «مرتجع» من العهدة الأولى و«دفعة» للعهدة التانية بنفس المبلغ والتاريخ،
-- ومربوطين ببعض (transfer_id). التحويل مش بنك ومش مصروف ولا وارد مشروع، فمفيش بنك بيتخصم منه.
-- للأدمن بس (زي المرتجع). إلغاء التحويل بيمسح الحركتين مع بعض.
create table public.advance_transfers (
  id uuid primary key default gen_random_uuid(),
  from_advance uuid not null references public.advances (id) on delete cascade,
  to_advance uuid not null references public.advances (id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  transfer_date date not null default current_date,
  notes text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (from_advance <> to_advance)
);
create index advance_transfers_from_idx on public.advance_transfers (from_advance);
create index advance_transfers_to_idx on public.advance_transfers (to_advance);
create index advance_transfers_created_by_idx on public.advance_transfers (created_by);

alter table public.advance_transfers enable row level security;
create policy advance_transfers_select on public.advance_transfers for select to authenticated
  using ((select private.is_active_user()));
revoke all on public.advance_transfers from anon;
revoke insert, update, delete on public.advance_transfers from authenticated;

alter table public.advance_installments add column transfer_id uuid references public.advance_transfers (id) on delete cascade;
alter table public.advance_returns add column transfer_id uuid references public.advance_transfers (id) on delete cascade;
create index advance_installments_transfer_idx on public.advance_installments (transfer_id);
create index advance_returns_transfer_idx on public.advance_returns (transfer_id);

-- دفعة التحويل من غير بنك: مسموحة للأدمن بس ولو مربوطة بتحويل موجود
create or replace function private.installment_bank_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    return new;
  end if;
  if new.transfer_id is not null and tg_op = 'INSERT' and private.is_admin()
     and exists (select 1 from public.advance_transfers t where t.id = new.transfer_id) then
    return new;
  end if;
  if new.bank_id is null then
    if tg_op = 'UPDATE' and old.bank_id is null then
      return new;
    end if;
    raise exception 'bank required' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and new.bank_id is not distinct from old.bank_id then
    return new;
  end if;
  if exists (select 1 from public.profiles where id = uid and role = 'owner')
     and not exists (select 1 from public.user_bank_access where user_id = uid and bank_id = new.bank_id) then
    raise exception 'bank not allowed' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create function public.transfer_between_advances(p_from uuid, p_to uuid, p_amount numeric, p_date date, p_notes text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  t uuid;
  from_name text;
  to_name text;
  extra text := nullif(btrim(coalesce(p_notes, '')), '');
begin
  if not private.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_from = p_to then
    raise exception 'two different custodies required' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive' using errcode = '22023';
  end if;
  select holder_name into from_name from public.advances where id = p_from;
  select holder_name into to_name from public.advances where id = p_to;
  if from_name is null or to_name is null then
    raise exception 'custody not found' using errcode = '22023';
  end if;
  insert into public.advance_transfers (from_advance, to_advance, amount, transfer_date, notes)
  values (p_from, p_to, p_amount, coalesce(p_date, current_date), extra)
  returning id into t;
  insert into public.advance_returns (advance_id, amount, returned_on, notes, transfer_id)
  values (p_from, p_amount, coalesce(p_date, current_date), 'تحويل إلى عهدة ' || to_name || coalesce(' · ' || extra, ''), t);
  insert into public.advance_installments (advance_id, amount, paid_on, transfer_id)
  values (p_to, p_amount, coalesce(p_date, current_date), t);
  return t;
end;
$$;
revoke execute on function public.transfer_between_advances(uuid, uuid, numeric, date, text) from public, anon;
grant execute on function public.transfer_between_advances(uuid, uuid, numeric, date, text) to authenticated;

create function public.cancel_advance_transfer(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  delete from public.advance_transfers where id = p_id;
end;
$$;
revoke execute on function public.cancel_advance_transfer(uuid) from public, anon;
grant execute on function public.cancel_advance_transfer(uuid) to authenticated;

alter publication supabase_realtime add table public.advance_transfers;

-- مسح البيانات لازم يمسح جدول التحويلات مع العهد (غير كده الـtruncate بيفشل)
create or replace function public.reset_data(p_groups text[] default array['entries', 'contractor_dues', 'projects', 'contractors', 'advances', 'banks', 'categories'])
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
    t := t || array['public.entry_attachments', 'public.entry_history', 'public.entries', 'public.entry_counters', 'public.bank_transfers'];
  end if;
  if 'contractor_dues' = any (g) then
    t := t || array['public.contractor_transactions', 'public.contractor_settlements'];
  end if;
  if 'projects' = any (g) then
    t := t || array['private.project_low_balance', 'public.project_shares', 'public.projects'];
  end if;
  if 'contractors' = any (g) then
    t := t || array['public.contractors'];
  end if;
  if 'advances' = any (g) then
    t := t || array['public.advance_transfers', 'public.advance_installments', 'public.pending_advance_installments', 'public.advance_returns',
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
