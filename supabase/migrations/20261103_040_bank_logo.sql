-- لوجو البنك: صورة صغيرة (data URL) بيرفعها اللي يقدر يعدّل البنوك، وبتظهر جنب اسم البنك.
alter table public.bank_accounts
  add column logo text check (logo is null or (logo like 'data:image/%' and length(logo) <= 60000));

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
      coalesce((select sum(e.amount) from public.entries e where e.bank_id = b.id and e.kind = 'expense' and e.status = 'approved'), 0) as expenses
    from public.bank_accounts b
  ) r
  where private.can_view('banks');
$$;
