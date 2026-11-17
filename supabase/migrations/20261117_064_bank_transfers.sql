-- تحويل فلوس من بنك لبنك: بيتخصم من بنك وبيتضاف للتاني بنفس المبلغ، من غير ما يتحسب وارد أو مصروف مشروع.
-- الإضافة والحذف للي معاه صلاحية تعديل «البنوك» بس، والقراءة لمن يشوف البنوك.
create table public.bank_transfers (
  id uuid primary key default gen_random_uuid(),
  from_bank uuid not null references public.bank_accounts (id) on delete cascade,
  to_bank uuid not null references public.bank_accounts (id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  transfer_date date not null default current_date,
  notes text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (from_bank <> to_bank)
);
create index bank_transfers_from_idx on public.bank_transfers (from_bank);
create index bank_transfers_to_idx on public.bank_transfers (to_bank);
create index bank_transfers_created_by_idx on public.bank_transfers (created_by);

alter table public.bank_transfers enable row level security;
create policy bank_transfers_select on public.bank_transfers for select to authenticated
  using ((select private.can_view('banks')));
create policy bank_transfers_insert on public.bank_transfers for insert to authenticated
  with check ((select private.can_edit('banks')));
create policy bank_transfers_delete on public.bank_transfers for delete to authenticated
  using ((select private.can_edit('banks')));
revoke all on public.bank_transfers from anon;

alter publication supabase_realtime add table public.bank_transfers;

-- ملخص البنوك: بنضيف «محوّل له» و«محوّل منه» جنب الوارد والمصروف. الرصيد = افتتاحي + وارد + محوّل له − مصروف − محوّل منه
create or replace function public.bank_summaries()
 returns jsonb
 language sql
 stable security definer
 set search_path to ''
as $function$
  select coalesce(jsonb_agg(r order by r.name), '[]'::jsonb)
  from (
    select
      b.id, b.name, b.logo, b.opening_balance,
      coalesce((select sum(e.amount) from public.entries e where e.bank_id = b.id and e.kind = 'income' and e.status = 'approved'
                and (b.balance_from is null or e.entry_date >= b.balance_from)), 0) as income,
      coalesce((select sum(e.amount) from public.entries e where e.bank_id = b.id and e.kind = 'expense' and e.status = 'approved'
                and (b.balance_from is null or e.entry_date >= b.balance_from)), 0)
        + coalesce((select sum(i.amount) from public.advance_installments i where i.bank_id = b.id and i.status = 'approved'
                and (b.balance_from is null or i.paid_on >= b.balance_from)), 0) as expenses,
      coalesce((select sum(t.amount) from public.bank_transfers t where t.to_bank = b.id
                and (b.balance_from is null or t.transfer_date >= b.balance_from)), 0) as transfers_in,
      coalesce((select sum(t.amount) from public.bank_transfers t where t.from_bank = b.id
                and (b.balance_from is null or t.transfer_date >= b.balance_from)), 0) as transfers_out
    from public.bank_accounts b
  ) r
  where private.can_view('banks');
$function$;

-- كشف حساب البنك: التحويلات داخلة بنوعها (transfer_in / transfer_out) واسم البنك التاني في خانة المقاول
create or replace function public.bank_movements(p_bank uuid)
 returns jsonb
 language sql
 stable security definer
 set search_path to ''
as $function$
  select coalesce(jsonb_agg(r order by r.entry_date, r.seq nulls last, r.created_at), '[]'::jsonb)
  from (
    select
      e.id, e.seq, e.kind, e.entry_date, e.category, e.item, e.notes, e.amount,
      p.id as project_id, p.name as project_name, c.name as contractor, e.created_at
    from public.entries e
    join public.projects p on p.id = e.project_id
    left join public.contractors c on c.id = e.contractor_id
    where e.bank_id = p_bank and e.status = 'approved'
      and e.entry_date >= coalesce((select b.balance_from from public.bank_accounts b where b.id = p_bank), date '0001-01-01')
    union all
    select
      i.id, null::bigint, 'expense', i.paid_on, 'دفعة عهدة', a.holder_name, null::text, i.amount,
      null::uuid, 'عهد', null::text, i.created_at
    from public.advance_installments i
    join public.advances a on a.id = i.advance_id
    where i.bank_id = p_bank and i.status = 'approved'
      and i.paid_on >= coalesce((select b.balance_from from public.bank_accounts b where b.id = p_bank), date '0001-01-01')
    union all
    select
      t.id, null::bigint,
      case when t.to_bank = p_bank then 'transfer_in' else 'transfer_out' end,
      t.transfer_date, 'تحويل بين بنوك',
      case when t.to_bank = p_bank then 'تحويل من ' || fb.name else 'تحويل إلى ' || tb.name end,
      t.notes, t.amount, null::uuid, 'تحويل بين بنوك', null::text, t.created_at
    from public.bank_transfers t
    join public.bank_accounts fb on fb.id = t.from_bank
    join public.bank_accounts tb on tb.id = t.to_bank
    where (t.from_bank = p_bank or t.to_bank = p_bank)
      and t.transfer_date >= coalesce((select b.balance_from from public.bank_accounts b where b.id = p_bank), date '0001-01-01')
  ) r
  where private.can_view('banks');
$function$;

-- إعادة الضبط: التحويلات بتتمسح مع القيود
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
