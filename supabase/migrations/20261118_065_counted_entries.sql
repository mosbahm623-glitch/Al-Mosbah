-- مصدر واحد للقيود المحسوبة. قبل كده كل دالة حساب كانت بتكرر شرط «معتمد» لوحدها
-- (الداشبورد 10 مرات، البنوك، المشاريع، العهد)، فأي تغيير في القاعدة كان لازم يتنسخ في كل مكان.
-- دلوقتي القاعدة مكتوبة مرة واحدة هنا: القيد بيتحسب لما يكون معتمد (المحذوف والمعلّق والمرفوض بره).
-- النتيجة نفسها بالظبط: ده تنظيف مش تغيير في الأرقام.

create view private.counted_entries with (security_invoker = true) as
  select * from public.entries where status = 'approved';

create view private.counted_installments with (security_invoker = true) as
  select * from public.advance_installments where status = 'approved';

revoke all on private.counted_entries, private.counted_installments from public, anon;
grant select on private.counted_entries, private.counted_installments to authenticated;

create or replace function private.advance_spent(p_advance uuid)
 returns numeric language sql stable security definer set search_path to '' as $$
  select coalesce(sum(e.amount), 0)
  from private.counted_entries e
  where e.advance_id = p_advance and e.kind = 'expense';
$$;

create or replace function private.project_balance(p_project uuid)
 returns numeric language sql stable security definer set search_path to '' as $$
  select coalesce(sum(case when kind = 'income' then amount else -amount end), 0)
  from private.counted_entries where project_id = p_project
$$;

create or replace function public.advance_summaries()
 returns jsonb language sql stable set search_path to '' as $$
  select coalesce(jsonb_agg(r order by r.created_at desc), '[]'::jsonb)
  from (
    select
      a.id, a.holder_name, a.status, a.notes, a.created_at,
      coalesce((select sum(i.amount) from private.counted_installments i where i.advance_id = a.id), 0) as given,
      private.advance_spent(a.id) as spent,
      coalesce((select sum(x.amount) from public.advance_returns x where x.advance_id = a.id), 0) as returned
    from public.advances a
  ) r;
$$;

create or replace function public.project_summaries()
 returns jsonb language sql stable set search_path to '' as $$
  select coalesce(jsonb_agg(r order by r.created_at desc), '[]'::jsonb)
  from (
    select
      p.id, p.name, p.budget, p.status, p.type, p.created_at,
      coalesce((select sum(e.amount) from private.counted_entries e where e.project_id = p.id and e.kind = 'income'), 0) as income,
      coalesce((select sum(e.amount) from private.counted_entries e where e.project_id = p.id and e.kind = 'expense'), 0) as expenses
    from public.projects p
  ) r;
$$;

create or replace function public.bank_summaries()
 returns jsonb language sql stable security definer set search_path to '' as $$
  select coalesce(jsonb_agg(r order by r.name), '[]'::jsonb)
  from (
    select
      b.id, b.name, b.logo, b.opening_balance,
      coalesce((select sum(e.amount) from private.counted_entries e where e.bank_id = b.id and e.kind = 'income'
                and (b.balance_from is null or e.entry_date >= b.balance_from)), 0) as income,
      coalesce((select sum(e.amount) from private.counted_entries e where e.bank_id = b.id and e.kind = 'expense'
                and (b.balance_from is null or e.entry_date >= b.balance_from)), 0)
        + coalesce((select sum(i.amount) from private.counted_installments i where i.bank_id = b.id
                and (b.balance_from is null or i.paid_on >= b.balance_from)), 0) as expenses,
      coalesce((select sum(t.amount) from public.bank_transfers t where t.to_bank = b.id
                and (b.balance_from is null or t.transfer_date >= b.balance_from)), 0) as transfers_in,
      coalesce((select sum(t.amount) from public.bank_transfers t where t.from_bank = b.id
                and (b.balance_from is null or t.transfer_date >= b.balance_from)), 0) as transfers_out
    from public.bank_accounts b
  ) r
  where private.can_view('banks');
$$;

create or replace function public.bank_movements(p_bank uuid)
 returns jsonb language sql stable security definer set search_path to '' as $$
  select coalesce(jsonb_agg(r order by r.entry_date, r.seq nulls last, r.created_at), '[]'::jsonb)
  from (
    select
      e.id, e.seq, e.kind, e.entry_date, e.category, e.item, e.notes, e.amount,
      p.id as project_id, p.name as project_name, c.name as contractor, e.created_at
    from private.counted_entries e
    join public.projects p on p.id = e.project_id
    left join public.contractors c on c.id = e.contractor_id
    where e.bank_id = p_bank
      and e.entry_date >= coalesce((select b.balance_from from public.bank_accounts b where b.id = p_bank), date '0001-01-01')
    union all
    select
      i.id, null::bigint, 'expense', i.paid_on, 'دفعة عهدة', a.holder_name, null::text, i.amount,
      null::uuid, 'عهد', null::text, i.created_at
    from private.counted_installments i
    join public.advances a on a.id = i.advance_id
    where i.bank_id = p_bank
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
$$;

create or replace function public.dashboard_summary()
 returns jsonb language sql stable security definer set search_path to '' as $$
  with
    live as (select id from public.projects where status = 'active'),
    inc as (select coalesce(sum(amount), 0) as v from private.counted_entries where kind = 'income' and project_id in (select id from live)),
    exp as (select coalesce(sum(amount), 0) as v from private.counted_entries where kind = 'expense' and advance_id is null and project_id in (select id from live)),
    adv as (
      select coalesce((select sum(amount) from private.counted_installments), 0)
           - coalesce((select sum(amount) from public.advance_returns), 0) as v
    ),
    due as (
      select coalesce(sum(case kind when 'due' then amount else -amount end), 0) as v
      from public.contractor_transactions
    ),
    spent_adv as (select coalesce(sum(amount), 0) as v from private.counted_entries where kind = 'expense' and advance_id is not null),
    spent_live as (select coalesce(sum(amount), 0) as v from private.counted_entries where kind = 'expense' and advance_id is not null and project_id in (select id from live)),
    act as (select count(*) as v from public.projects where status = 'active'),
    ps as (
      select p.id, p.name, p.budget,
        coalesce((select sum(e.amount) from private.counted_entries e where e.project_id = p.id and e.kind = 'expense'), 0) as spent
      from public.projects p
      where p.status = 'active' and p.budget > 0
    )
  select jsonb_build_object(
    'total_income', inc.v,
    'total_expenses', exp.v + spent_live.v,
    'total_advances', adv.v,
    'advances_balance', adv.v - spent_adv.v,
    'contractor_dues', due.v,
    'active_projects', act.v,
    'net_cash', inc.v - (exp.v + spent_live.v) - (adv.v - spent_adv.v) + due.v,
    'over_count', (select count(*) from ps where ps.spent > ps.budget),
    'budget_rows', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', t.id, 'name', t.name, 'budget', t.budget, 'spent', t.spent, 'over', t.spent > t.budget)
        order by t.spent - t.budget desc, t.name
      )
      from (select * from ps order by ps.spent - ps.budget desc, ps.name limit 10) t
    ), '[]'::jsonb)
  )
  from inc, exp, adv, spent_adv, spent_live, due, act
  where private.can_view('dashboard');
$$;
