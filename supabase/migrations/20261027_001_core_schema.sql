-- Al Mosbah: core schema, row level security, dashboard summary

-- ===== Profiles (one per auth user; inactive until an admin activates it) =====
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role text not null default 'user' check (role in ('admin', 'user')),
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and is_active
  );
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and is_active and role = 'admin'
  );
$$;

revoke execute on function public.is_active_user() from public, anon;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- ===== Business tables =====
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  budget numeric(14, 2) not null default 0 check (budget >= 0),
  status text not null default 'active' check (status in ('active', 'closed')),
  created_at timestamptz not null default now()
);

create table public.contractors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- عهدة: money handed to a person (e.g. an engineer) to spend on a project
create table public.advances (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id),
  holder_name text not null,
  created_at timestamptz not null default now()
);

-- دفعات العهدة
create table public.advance_installments (
  id uuid primary key default gen_random_uuid(),
  advance_id uuid not null references public.advances (id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  paid_on date not null default current_date,
  created_at timestamptz not null default now()
);

-- مستحقات ومدفوعات المقاولين: 'due' increases what we owe, 'payment' decreases it
create table public.contractor_transactions (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.contractors (id),
  project_id uuid references public.projects (id),
  kind text not null check (kind in ('due', 'payment')),
  amount numeric(14, 2) not null check (amount > 0),
  txn_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

-- القيود: income / expense entries with a running serial number (seq)
-- An entry with advance_id set was paid out of a custody, so it is not counted
-- again in project expenses (the custody installments are counted instead).
create table public.entries (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity,
  project_id uuid not null references public.projects (id),
  kind text not null check (kind in ('income', 'expense')),
  category text not null,
  amount numeric(14, 2) not null check (amount > 0),
  entry_date date not null default current_date,
  notes text,
  advance_id uuid references public.advances (id),
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);

create index entries_project_id_idx on public.entries (project_id);
create index entries_advance_id_idx on public.entries (advance_id);
create index entries_created_by_idx on public.entries (created_by);
create index advances_project_id_idx on public.advances (project_id);
create index advance_installments_advance_id_idx on public.advance_installments (advance_id);
create index contractor_transactions_contractor_id_idx on public.contractor_transactions (contractor_id);
create index contractor_transactions_project_id_idx on public.contractor_transactions (project_id);

-- ===== Row level security =====
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.contractors enable row level security;
alter table public.advances enable row level security;
alter table public.advance_installments enable row level security;
alter table public.contractor_transactions enable row level security;
alter table public.entries enable row level security;

-- profiles: everyone sees their own row; admins see and manage all
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy profiles_update_admin on public.profiles
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- business tables: active users read, admins write
do $$
declare
  t text;
begin
  foreach t in array array[
    'projects', 'contractors', 'advances', 'advance_installments',
    'contractor_transactions', 'entries'
  ]
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select public.is_active_user()))',
      t || '_select', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select public.is_admin()))',
      t || '_insert_admin', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))',
      t || '_update_admin', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select public.is_admin()))',
      t || '_delete_admin', t);
  end loop;
end;
$$;

-- ===== Dashboard summary (runs with the caller's rights, so RLS applies) =====
create function public.dashboard_summary()
returns jsonb
language sql
stable
set search_path = ''
as $$
  with
    inc as (
      select coalesce(sum(amount), 0) as v
      from public.entries where kind = 'income'
    ),
    exp as (
      select coalesce(sum(amount), 0) as v
      from public.entries where kind = 'expense' and advance_id is null
    ),
    adv as (
      select coalesce(sum(amount), 0) as v from public.advance_installments
    ),
    due as (
      select coalesce(sum(case kind when 'due' then amount else -amount end), 0) as v
      from public.contractor_transactions
    ),
    act as (
      select count(*) as v from public.projects where status = 'active'
    ),
    spent as (
      select
        p.id, p.name, p.budget,
        coalesce((
          select sum(e.amount) from public.entries e
          where e.project_id = p.id and e.kind = 'expense' and e.advance_id is null
        ), 0)
        + coalesce((
          select sum(i.amount)
          from public.advance_installments i
          join public.advances a on a.id = i.advance_id
          where a.project_id = p.id
        ), 0) as spent
      from public.projects p
      where p.status = 'active' and p.budget > 0
    )
  select jsonb_build_object(
    'total_income', inc.v,
    'total_expenses', exp.v,
    'total_advances', adv.v,
    'contractor_dues', due.v,
    'active_projects', act.v,
    'net_cash', inc.v - exp.v - adv.v + due.v,
    'over_budget', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', s.id, 'name', s.name, 'budget', s.budget, 'spent', s.spent)
        order by s.spent - s.budget desc
      )
      from spent s where s.spent > s.budget
    ), '[]'::jsonb)
  )
  from inc, exp, adv, due, act;
$$;

revoke execute on function public.dashboard_summary() from public, anon;
grant execute on function public.dashboard_summary() to authenticated;
