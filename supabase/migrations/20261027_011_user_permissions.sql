-- Per-page permissions. Admins can do everything; other active users get a level per module:
-- 'view' (read only) or 'edit' (read + write). No row = no access.
alter table public.profiles add column email text;
update public.profiles p set email = lower(u.email) from auth.users u where u.id = p.id;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data ->> 'full_name', lower(new.email));
  return new;
end;
$$;

create table public.user_permissions (
  user_id uuid not null references public.profiles (id) on delete cascade,
  module text not null check (module in ('dashboard', 'projects', 'advances', 'contractors', 'reports', 'tools')),
  level text not null check (level in ('view', 'edit')),
  primary key (user_id, module)
);
alter table public.user_permissions enable row level security;

create function private.can_view(m text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin() or exists (
    select 1 from public.user_permissions up
    join public.profiles p on p.id = up.user_id
    where up.user_id = (select auth.uid()) and p.is_active and up.module = m
  );
$$;

create function private.can_edit(m text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin() or exists (
    select 1 from public.user_permissions up
    join public.profiles p on p.id = up.user_id
    where up.user_id = (select auth.uid()) and p.is_active and up.module = m and up.level = 'edit'
  );
$$;

-- any permission at all (needed to read shared lookups such as the project list)
create function private.has_any_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin() or exists (
    select 1 from public.user_permissions up
    join public.profiles p on p.id = up.user_id
    where up.user_id = (select auth.uid()) and p.is_active
  );
$$;

revoke execute on function private.can_view(text), private.can_edit(text), private.has_any_access() from public, anon;
grant execute on function private.can_view(text), private.can_edit(text), private.has_any_access() to authenticated;

-- user_permissions: you can read your own rows; admins manage everything
create policy user_permissions_select on public.user_permissions for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy user_permissions_insert_admin on public.user_permissions for insert to authenticated with check ((select private.is_admin()));
create policy user_permissions_update_admin on public.user_permissions for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy user_permissions_delete_admin on public.user_permissions for delete to authenticated using ((select private.is_admin()));

-- an admin cannot demote or deactivate his own account (lock-out protection)
create function private.protect_own_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.id = (select auth.uid()) and (new.role is distinct from old.role or new.is_active is distinct from old.is_active) then
    raise exception 'You cannot change your own role or status' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function private.protect_own_profile() from public, anon, authenticated;
create trigger protect_own_profile before update on public.profiles
  for each row execute function private.protect_own_profile();

-- allow-list entry for a new account (called only by the create-user edge function)
create function public.add_allowed_email(p_email text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.allowed_emails (email) values (lower(p_email)) on conflict do nothing;
$$;
revoke execute on function public.add_allowed_email(text) from public, anon, authenticated;
grant execute on function public.add_allowed_email(text) to service_role;

-- ===== business tables =====
-- drop the old "active read / admin write" policies
do $$
declare
  p record;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('projects','contractors','advances','advance_installments','advance_returns',
                        'contractor_transactions','entries','expense_categories','expense_items','bank_accounts')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end;
$$;

-- tables owned by one module: that module's level decides
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('advances', 'advances'), ('advance_installments', 'advances'), ('advance_returns', 'advances'),
      ('contractor_transactions', 'contractors')
    ) as v(tbl, module)
  loop
    execute format('create policy %I on public.%I for select to authenticated using ((select private.can_view(%L)))', r.tbl || '_select', r.tbl, r.module);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select private.can_edit(%L)))', r.tbl || '_insert', r.tbl, r.module);
    execute format('create policy %I on public.%I for update to authenticated using ((select private.can_edit(%L))) with check ((select private.can_edit(%L)))', r.tbl || '_update', r.tbl, r.module, r.module);
    execute format('create policy %I on public.%I for delete to authenticated using ((select private.can_edit(%L)))', r.tbl || '_delete', r.tbl, r.module);
  end loop;
end;
$$;

-- projects: anyone with access can read the list (it feeds pickers); only project editors change it
create policy projects_select on public.projects for select to authenticated using ((select private.has_any_access()));
create policy projects_insert on public.projects for insert to authenticated with check ((select private.can_edit('projects')));
create policy projects_update on public.projects for update to authenticated using ((select private.can_edit('projects'))) with check ((select private.can_edit('projects')));
create policy projects_delete on public.projects for delete to authenticated using ((select private.can_edit('projects')));

-- entries: project entries follow "projects"; entries paid from a custody follow "advances"
create policy entries_select on public.entries for select to authenticated
  using ((select private.can_view('projects')) or (advance_id is not null and (select private.can_view('advances'))));
create policy entries_insert on public.entries for insert to authenticated
  with check ((select private.can_edit('projects')) or (advance_id is not null and (select private.can_edit('advances'))));
create policy entries_update on public.entries for update to authenticated
  using ((select private.can_edit('projects')) or (advance_id is not null and (select private.can_edit('advances'))))
  with check ((select private.can_edit('projects')) or (advance_id is not null and (select private.can_edit('advances'))));
create policy entries_delete on public.entries for delete to authenticated
  using ((select private.can_edit('projects')) or (advance_id is not null and (select private.can_edit('advances'))));

-- shared lookups (contractor names, بنود, banks): anyone with access reads; project/custody/contractor editors add
do $$
declare
  t text;
begin
  foreach t in array array['contractors', 'expense_categories', 'expense_items', 'bank_accounts']
  loop
    execute format('create policy %I on public.%I for select to authenticated using ((select private.has_any_access()))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select private.can_edit(''projects'')) or (select private.can_edit(''advances'')) or (select private.can_edit(''contractors'')))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select private.is_admin()))', t || '_delete', t);
  end loop;
end;
$$;

-- dashboard: aggregate numbers, so it runs with definer rights and is gated by the "dashboard" permission
create or replace function public.dashboard_summary()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with
    inc as (select coalesce(sum(amount), 0) as v from public.entries where kind = 'income'),
    exp as (select coalesce(sum(amount), 0) as v from public.entries where kind = 'expense' and advance_id is null),
    adv as (
      select coalesce((select sum(amount) from public.advance_installments), 0)
           - coalesce((select sum(amount) from public.advance_returns), 0) as v
    ),
    due as (
      select coalesce(sum(case kind when 'due' then amount else -amount end), 0) as v
      from public.contractor_transactions
    ),
    spent_adv as (select coalesce(sum(amount), 0) as v from public.entries where kind = 'expense' and advance_id is not null),
    act as (select count(*) as v from public.projects where status = 'active'),
    ps as (
      select p.id, p.name, p.budget,
        coalesce((select sum(e.amount) from public.entries e where e.project_id = p.id and e.kind = 'expense'), 0) as spent
      from public.projects p
      where p.status = 'active' and p.budget > 0
    )
  select jsonb_build_object(
    'total_income', inc.v,
    'total_expenses', exp.v,
    'total_advances', adv.v,
    'advances_balance', adv.v - spent_adv.v,
    'contractor_dues', due.v,
    'active_projects', act.v,
    'net_cash', inc.v - exp.v - adv.v + due.v,
    'over_count', (select count(*) from ps where ps.spent > ps.budget),
    'budget_rows', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', t.id, 'name', t.name, 'budget', t.budget, 'spent', t.spent, 'over', t.spent > t.budget)
        order by t.spent - t.budget desc, t.name
      )
      from (select * from ps order by ps.spent - ps.budget desc, ps.name limit 10) t
    ), '[]'::jsonb)
  )
  from inc, exp, adv, spent_adv, due, act
  where private.can_view('dashboard');
$$;
revoke execute on function public.dashboard_summary() from public, anon;
grant execute on function public.dashboard_summary() to authenticated;
