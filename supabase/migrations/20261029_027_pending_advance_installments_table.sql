-- Mirrors the migration "pending_advance_installments_table" that was applied straight to the live database.
-- Re-runnable: a no-op on the live database. Holds custody payments that wait for the admin's approval.

create table if not exists public.pending_advance_installments (
  id uuid primary key default gen_random_uuid(),
  advance_id uuid not null references public.advances (id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  paid_on date not null default current_date,
  payment_method text,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
alter table public.pending_advance_installments enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'pending_advance_installments' and policyname = 'pending_adv_inst_select') then
    create policy pending_adv_inst_select on public.pending_advance_installments for select to authenticated
      using ((select private.can_view('advances')));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'pending_advance_installments' and policyname = 'pending_adv_inst_insert') then
    create policy pending_adv_inst_insert on public.pending_advance_installments for insert to authenticated
      with check ((select private.can_edit('advances')));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'pending_advance_installments' and policyname = 'pending_adv_inst_update') then
    create policy pending_adv_inst_update on public.pending_advance_installments for update to authenticated
      using ((select private.can_edit('advances'))) with check ((select private.can_edit('advances')));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'pending_advance_installments' and policyname = 'pending_adv_inst_delete') then
    create policy pending_adv_inst_delete on public.pending_advance_installments for delete to authenticated
      using ((select private.can_edit('advances')));
  end if;
end $$;
