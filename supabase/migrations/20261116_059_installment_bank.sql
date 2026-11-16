-- دفعة العهدة بتطلع من حساب بنك: كل دفعة جديدة لازم يكون لها بنك، وبتتخصم من رصيد البنك.
-- الدفعات القديمة (من غير بنك) تفضل زي ما هي ومش بتتحسب على أي بنك.
alter table public.advance_installments add column bank_id uuid references public.bank_accounts (id);
create index advance_installments_bank_id_idx on public.advance_installments (bank_id);

-- بنك لازم عند التسجيل. المالك يختار من قايمته بس. تعديل دفعة قديمة من غير بنك (زي الموافقة عليها) مسموح.
create function private.installment_bank_access()
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
revoke execute on function private.installment_bank_access() from public, anon, authenticated;
create trigger installment_bank_access before insert or update on public.advance_installments
  for each row execute function private.installment_bank_access();

-- المصروف على البنك = قيود المصروف + دفعات العهدة المعتمدة اللي خرجت منه
create or replace function public.bank_summaries()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(r order by r.name), '[]'::jsonb)
  from (
    select
      b.id, b.name, b.logo, b.opening_balance,
      coalesce((select sum(e.amount) from public.entries e where e.bank_id = b.id and e.kind = 'income' and e.status = 'approved'), 0) as income,
      coalesce((select sum(e.amount) from public.entries e where e.bank_id = b.id and e.kind = 'expense' and e.status = 'approved'), 0)
        + coalesce((select sum(i.amount) from public.advance_installments i where i.bank_id = b.id and i.status = 'approved'), 0) as expenses
    from public.bank_accounts b
  ) r
  where private.can_view('banks');
$$;

-- حركات البنك: القيود + دفعات العهدة (مصروف، تحت اسم "عهد")
create or replace function public.bank_movements(p_bank uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(r order by r.entry_date, r.seq), '[]'::jsonb)
  from (
    select
      e.id, e.seq, e.kind, e.entry_date, e.category, e.item, e.notes, e.amount,
      p.id as project_id, p.name as project_name, c.name as contractor
    from public.entries e
    join public.projects p on p.id = e.project_id
    left join public.contractors c on c.id = e.contractor_id
    where e.bank_id = p_bank and e.status = 'approved'
    union all
    select
      i.id, null::bigint, 'expense', i.paid_on, 'دفعة عهدة', a.holder_name, null::text, i.amount,
      null::uuid, 'عهد', null::text
    from public.advance_installments i
    join public.advances a on a.id = i.advance_id
    where i.bank_id = p_bank and i.status = 'approved'
  ) r
  where private.can_view('banks');
$$;
