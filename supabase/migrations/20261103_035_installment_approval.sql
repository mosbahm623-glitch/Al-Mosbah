-- Custody payments (دفعات العهدة) wait for the admin's approval when anyone but the admin records them (the owner
-- hands custodies out, the admin approves). Same rules as entries: only approved payments count in the totals, the admin
-- approves or rejects (a rejection needs a reason), and an admin's own payment is approved at once.
-- Every payment that exists today stays approved.
alter table public.advance_installments
  add column status text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
  add column created_by uuid references public.profiles (id),
  add column decided_by uuid references public.profiles (id),
  add column decided_at timestamptz,
  add column reject_reason text;
create index advance_installments_status_idx on public.advance_installments (status) where status <> 'approved';
create index advance_installments_created_by_idx on public.advance_installments (created_by);
create index advance_installments_decided_by_idx on public.advance_installments (decided_by);

create function private.installment_approval_flow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
    new.decided_by := null; new.decided_at := null; new.reject_reason := null;
    new.status := case when private.is_admin() or (select auth.uid()) is null then 'approved' else 'pending' end;
  else
    new.created_by := old.created_by;
    if private.is_admin() or (select auth.uid()) is null then
      if new.status is distinct from old.status then
        new.decided_by := (select auth.uid()); new.decided_at := now();
        if new.status = 'rejected' then
          new.reject_reason := btrim(coalesce(new.reject_reason, ''));
          if char_length(new.reject_reason) < 2 then raise exception 'reason required' using errcode = '22023'; end if;
        else
          new.reject_reason := null;
        end if;
      else
        new.decided_by := old.decided_by; new.decided_at := old.decided_at; new.reject_reason := old.reject_reason;
      end if;
    elsif old.status = 'approved' then
      -- an approved payment is the admin's to change
      new.status := 'approved'; new.amount := old.amount; new.paid_on := old.paid_on; new.advance_id := old.advance_id;
      new.decided_by := old.decided_by; new.decided_at := old.decided_at; new.reject_reason := null;
    else
      -- the owner fixed a waiting or rejected payment: it goes back to the admin
      new.status := 'pending'; new.decided_by := null; new.decided_at := null; new.reject_reason := null;
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function private.installment_approval_flow() from public, anon, authenticated;
create trigger installment_approval_flow before insert or update on public.advance_installments
  for each row execute function private.installment_approval_flow();

-- an owner may change or remove only payments that are not approved yet; the admin may change any
drop policy advance_installments_update on public.advance_installments;
drop policy advance_installments_delete on public.advance_installments;
create policy advance_installments_update on public.advance_installments for update to authenticated
  using ((select private.is_admin()) or ((select private.is_staff()) and status <> 'approved'))
  with check ((select private.is_staff()));
create policy advance_installments_delete on public.advance_installments for delete to authenticated
  using ((select private.is_admin()) or ((select private.is_staff()) and status <> 'approved'));

-- totals count approved payments only
create or replace function public.advance_summaries()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(r order by r.created_at desc), '[]'::jsonb)
  from (
    select
      a.id, a.holder_name, a.status, a.notes, a.created_at,
      coalesce((select sum(i.amount) from public.advance_installments i where i.advance_id = a.id and i.status = 'approved'), 0) as given,
      coalesce((select sum(e.amount) from public.entries e where e.advance_id = a.id and e.kind = 'expense' and e.status = 'approved'), 0) as spent,
      coalesce((select sum(x.amount) from public.advance_returns x where x.advance_id = a.id), 0) as returned
    from public.advances a
  ) r;
$$;

create or replace function public.dashboard_summary()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with
    inc as (select coalesce(sum(amount), 0) as v from public.entries where kind = 'income' and status = 'approved'),
    exp as (select coalesce(sum(amount), 0) as v from public.entries where kind = 'expense' and advance_id is null and status = 'approved'),
    adv as (
      select coalesce((select sum(amount) from public.advance_installments where status = 'approved'), 0)
           - coalesce((select sum(amount) from public.advance_returns), 0) as v
    ),
    due as (
      select coalesce(sum(case kind when 'due' then amount else -amount end), 0) as v
      from public.contractor_transactions
    ),
    spent_adv as (select coalesce(sum(amount), 0) as v from public.entries where kind = 'expense' and advance_id is not null and status = 'approved'),
    act as (select count(*) as v from public.projects where status = 'active'),
    ps as (
      select p.id, p.name, p.budget,
        coalesce((select sum(e.amount) from public.entries e where e.project_id = p.id and e.kind = 'expense' and e.status = 'approved'), 0) as spent
      from public.projects p
      where p.status = 'active' and p.budget > 0
    )
  select jsonb_build_object(
    'total_income', inc.v,
    'total_expenses', exp.v + spent_adv.v,
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

-- the admin hears about a payment waiting for approval; the one who recorded it hears the decision.
-- A failure here never blocks the payment itself.
create function private.notify_installment_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := (select auth.uid()); who text; holder text; txt text;
begin
  select full_name into who from public.profiles where id = actor;
  select holder_name into holder from public.advances where id = new.advance_id;
  txt := 'دفعة عهدة · ' || coalesce(holder, '') || ' · ' || new.amount::text || ' ج.م';

  if tg_op = 'INSERT' then
    if new.status = 'pending' then
      insert into public.notifications (user_id, kind, title, body, url)
      select p.id, 'pending', 'دفعة عهدة جديدة مستنّية موافقتك' || coalesce(' من ' || who, ''), txt, '#/approvals'
      from public.profiles p where p.role = 'admin' and p.is_active and p.id is distinct from actor;
    end if;
    return new;
  end if;

  if new.status is not distinct from old.status then return new; end if;
  if new.status = 'pending' then
    insert into public.notifications (user_id, kind, title, body, url)
    select p.id, 'pending', 'دفعة عهدة اتعدّلت ومستنّية موافقتك' || coalesce(' من ' || who, ''), txt, '#/approvals'
    from public.profiles p where p.role = 'admin' and p.is_active and p.id is distinct from actor;
  elsif new.status in ('approved', 'rejected') and new.created_by is not null and new.created_by is distinct from actor then
    if new.status = 'rejected' then txt := txt || coalesce(' · السبب: ' || new.reject_reason, ''); end if;
    insert into public.notifications (user_id, kind, title, body, url)
    values (new.created_by, new.status,
            case when new.status = 'approved' then 'اتوافق على دفعة العهدة بتاعتك' else 'اترفضت دفعة العهدة بتاعتك' end,
            txt, '#/advances/' || new.advance_id);
  end if;
  return new;
exception when others then
  return new;
end;
$$;
revoke execute on function private.notify_installment_change() from public, anon, authenticated;
create trigger installment_notify after insert or update on public.advance_installments
  for each row execute function private.notify_installment_change();
